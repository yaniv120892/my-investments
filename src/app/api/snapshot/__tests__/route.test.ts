import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const priceHoldings = vi.fn();
const sendErrorNotification = vi.fn();
const sendSnapshotNotification = vi.fn();
const findManyUsers = vi.fn();
const createSnapshot = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findMany: () => findManyUsers() },
    holdingSnapshot: {
      create: (...args: unknown[]) => createSnapshot(...args),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/lib/pricing/portfolioPricingService", () => ({
  priceHoldings: (holdings: unknown) => priceHoldings(holdings),
}));

vi.mock("@/lib/telegramNotifier", () => ({
  sendErrorNotification: (text: string) => sendErrorNotification(text),
  sendSnapshotNotification: (...args: unknown[]) =>
    sendSnapshotNotification(...args),
}));

vi.mock("@/lib/snapshotAuthorization", () => ({
  isSnapshotRequestAuthorized: () => true,
  isCronSecretAuthorized: () => true,
}));

const { POST } = await import("@/app/api/snapshot/route");

function request(): NextRequest {
  return new NextRequest("https://example.test/api/snapshot", {
    method: "POST",
  });
}

describe("POST /api/snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendErrorNotification.mockResolvedValue(true);
    sendSnapshotNotification.mockResolvedValue(true);
    createSnapshot.mockResolvedValue({});
  });

  /**
   * A throw out of the per-user loop — an FX outage, a database error — takes
   * down every user at once, unlike a single unpriced holding. It used to reach
   * only console.error, making the one total failure the quietest one.
   */
  it("alerts when the run dies before any user is priced", async () => {
    findManyUsers.mockRejectedValue(new Error("Frankfurter is unreachable"));

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(sendErrorNotification).toHaveBeenCalledTimes(1);
    expect(sendErrorNotification.mock.calls[0][0]).toContain(
      "Frankfurter is unreachable"
    );
  });

  it("names the user whose holdings could not be priced", async () => {
    findManyUsers.mockResolvedValue([
      { id: "user-1", holdings: [{ id: "h1", quantity: 1 }] },
    ]);
    priceHoldings.mockResolvedValue({
      valuations: [],
      failures: [
        {
          holdingId: "h1",
          assetName: "TLV 125",
          sourceSymbol: "5109889",
          reason: "Maya request failed",
        },
      ],
      usdToNisRate: 3.05,
      totalValueNis: null,
    });

    await POST(request());

    expect(sendErrorNotification).toHaveBeenCalledTimes(1);
    expect(sendErrorNotification.mock.calls[0][0]).toContain("user-1");
    expect(sendErrorNotification.mock.calls[0][0]).toContain("TLV 125");
  });

  it("writes nothing and alerts once per skipped user", async () => {
    findManyUsers.mockResolvedValue([
      { id: "user-1", holdings: [{ id: "h1", quantity: 1 }] },
      { id: "user-2", holdings: [{ id: "h2", quantity: 2 }] },
    ]);
    priceHoldings.mockResolvedValue({
      valuations: [],
      failures: [
        {
          holdingId: "h1",
          assetName: "TLV 125",
          sourceSymbol: "5109889",
          reason: "Maya request failed",
        },
      ],
      usdToNisRate: 3.05,
      totalValueNis: null,
    });

    const response = await POST(request());
    const body = await response.json();

    expect(body.usersSkipped).toBe(2);
    expect(sendErrorNotification).toHaveBeenCalledTimes(2);
    expect(sendSnapshotNotification).not.toHaveBeenCalled();
  });

  /**
   * A run that skipped every user used to answer 200, so the scheduled cron
   * recorded a success and five weeks of empty history looked like five weeks
   * of working history.
   */
  it("fails the run when no rows were written but holdings exist", async () => {
    findManyUsers.mockResolvedValue([
      { id: "user-1", holdings: [{ id: "h1", quantity: 1 }] },
    ]);
    priceHoldings.mockResolvedValue({
      valuations: [],
      failures: [
        {
          holdingId: "h1",
          assetName: "TLV 125",
          sourceSymbol: "5109889",
          reason: "Maya request failed",
        },
      ],
      usdToNisRate: 3.05,
      totalValueNis: null,
    });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.snapshotRowsWritten).toBe(0);
    expect(body.error).toContain("no rows");
  });

  it("succeeds without writing when no user holds anything", async () => {
    findManyUsers.mockResolvedValue([{ id: "user-1", holdings: [] }]);

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.snapshotRowsWritten).toBe(0);
    expect(priceHoldings).not.toHaveBeenCalled();
  });

  it("reports the row count and duration of a successful run", async () => {
    const logged: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      logged.push(String(line));
    });

    findManyUsers.mockResolvedValue([
      {
        id: "user-1",
        holdings: [
          { id: "h1", quantity: 2 },
          { id: "h2", quantity: 4 },
        ],
      },
    ]);
    priceHoldings.mockResolvedValue({
      valuations: [
        {
          holdingId: "h1",
          assetName: "VOO",
          valueInNis: 100,
          unitPrice: 50,
          currency: "USD",
          fxRateUsed: 3.05,
          fetchedAt: new Date(),
        },
        {
          holdingId: "h2",
          assetName: "TLV 125",
          valueInNis: 200,
          unitPrice: 50,
          currency: "NIS",
          fxRateUsed: 1,
          fetchedAt: new Date(),
        },
      ],
      failures: [],
      usdToNisRate: 3.05,
      totalValueNis: 300,
    });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.usersProcessed).toBe(1);
    expect(body.snapshotRowsWritten).toBe(2);
    expect(createSnapshot).toHaveBeenCalledTimes(2);
    expect(logged.join("\n")).toContain("snapshotRowsWritten=2");
    expect(typeof body.durationMs).toBe("number");
  });
});
