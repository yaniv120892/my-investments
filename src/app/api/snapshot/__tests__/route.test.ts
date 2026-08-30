import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function pricingResultWithUnpricedHolding() {
  return {
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
  };
}

function pricedValuation(holdingId: string, valueInNis: number) {
  return {
    holdingId,
    assetName: `asset-${holdingId}`,
    valueInNis,
    unitPrice: 50,
    currency: "NIS",
    fxRateUsed: 1,
    fetchedAt: new Date(),
  };
}

describe("POST /api/snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendErrorNotification.mockResolvedValue(true);
    sendSnapshotNotification.mockResolvedValue(true);
    createSnapshot.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * A throw out of the per-user loop — an FX outage, a database error — takes
   * down every user at once, unlike a single unpriced holding. It used to reach
   * only console.error, making the one total failure the quietest one.
   */
  it("alerts when the run dies before any user is priced", async () => {
    const logged: string[] = [];
    vi.spyOn(console, "error").mockImplementation((line: unknown) => {
      logged.push(String(line));
    });
    findManyUsers.mockRejectedValue(new Error("Frankfurter is unreachable"));

    const response = await POST(request());

    expect(response.status).toBe(500);
    // A throw part-way through is exactly when the counts matter, so the run
    // still reports how far it got.
    expect(logged.join("\n")).toContain(
      "Snapshot run failed: usersProcessed=0"
    );
    expect(sendErrorNotification).toHaveBeenCalledTimes(1);
    expect(sendErrorNotification.mock.calls[0][0]).toContain(
      "Frankfurter is unreachable"
    );
  });

  it("names the user whose holdings could not be priced", async () => {
    findManyUsers.mockResolvedValue([
      { id: "user-1", holdings: [{ id: "h1", quantity: 1 }] },
    ]);
    priceHoldings.mockResolvedValue(pricingResultWithUnpricedHolding());

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
    priceHoldings.mockResolvedValue(pricingResultWithUnpricedHolding());

    const response = await POST(request());
    const body = await response.json();

    expect(body.usersSkipped).toBe(2);
    expect(sendErrorNotification).toHaveBeenCalledTimes(2);
    expect(sendSnapshotNotification).not.toHaveBeenCalled();
  });

  it("fails the run when no rows were written but holdings exist", async () => {
    findManyUsers.mockResolvedValue([
      { id: "user-1", holdings: [{ id: "h1", quantity: 1 }] },
    ]);
    priceHoldings.mockResolvedValue(pricingResultWithUnpricedHolding());

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

  /**
   * The predicate has to be "nothing was written", not "someone was skipped" —
   * otherwise one unpriceable user would fail a run that snapshotted everyone
   * else, and the cron would report a failure that lost no history.
   */
  it("succeeds when one user is skipped but another is snapshotted", async () => {
    findManyUsers.mockResolvedValue([
      { id: "user-1", holdings: [{ id: "h1", quantity: 2 }] },
      { id: "user-2", holdings: [{ id: "h2", quantity: 3 }] },
    ]);
    priceHoldings
      .mockResolvedValueOnce({
        valuations: [pricedValuation("h1", 100)],
        failures: [],
        usdToNisRate: 3.05,
        totalValueNis: 100,
      })
      .mockResolvedValueOnce(pricingResultWithUnpricedHolding());

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.usersProcessed).toBe(1);
    expect(body.usersSkipped).toBe(1);
    expect(body.snapshotRowsWritten).toBe(1);
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
      valuations: [pricedValuation("h1", 100), pricedValuation("h2", 200)],
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
