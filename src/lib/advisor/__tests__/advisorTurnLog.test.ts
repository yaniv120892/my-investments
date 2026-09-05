import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, sendErrorNotification } = vi.hoisted(() => ({
  create: vi.fn(),
  sendErrorNotification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { advisorTurn: { create } } }));
vi.mock("@/lib/telegramNotifier", () => ({ sendErrorNotification }));

const { recordAdvisorTurn } = await import("@/lib/advisor/advisorTurnLog");

const GROUNDED = {
  userId: "user-1",
  toolIds: ["planContribution"],
  plannedCount: 1,
  refusalReasons: [],
  isGrounded: true,
  ungrounded: [],
  replyChars: 120,
  durationMs: 900,
};

describe("recordAdvisorTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({});
    sendErrorNotification.mockResolvedValue(true);
  });

  it("writes the turn and stays quiet when every figure was grounded", async () => {
    await recordAdvisorTurn(GROUNDED);

    expect(create).toHaveBeenCalledWith({ data: GROUNDED });
    expect(sendErrorNotification).not.toHaveBeenCalled();
  });

  it("alerts, naming the figures, when one was not", async () => {
    await recordAdvisorTurn({
      ...GROUNDED,
      isGrounded: false,
      ungrounded: ["37,500", "12,500"],
    });

    expect(sendErrorNotification).toHaveBeenCalledTimes(1);
    expect(sendErrorNotification.mock.calls[0][0]).toContain("37,500");
  });

  it("does not fail the turn when the write fails", async () => {
    create.mockRejectedValue(new Error("database down"));

    await expect(recordAdvisorTurn(GROUNDED)).resolves.toBeUndefined();
  });

  it("does not fail the turn when the alert fails", async () => {
    sendErrorNotification.mockRejectedValue(new Error("telegram down"));

    await expect(
      recordAdvisorTurn({ ...GROUNDED, isGrounded: false, ungrounded: ["1"] })
    ).resolves.toBeUndefined();
  });
});
