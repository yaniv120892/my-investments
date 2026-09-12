import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FRAME_SEPARATOR,
  decodeFrame,
} from "@/lib/advisor/advisorStreamProtocol";
import type { AdvisorStreamFrame } from "@/lib/advisor/advisorStreamProtocol.types";
import type { AdvisorTurnRecorder } from "@/lib/advisor/advisorTurnRecorder";

const { streamAdvisorResponse } = vi.hoisted(() => ({
  streamAdvisorResponse: vi.fn(),
}));

vi.mock("@/lib/advisor/advisorChatService", () => ({
  advisorChatService: { streamAdvisorResponse },
}));

vi.mock("@/lib/advisor/advisorModel", () => ({
  isAdvisorModelConfigured: () => true,
  requiredApiKeyName: () => "OPENAI_API_KEY",
}));

const { POST } = await import("@/app/api/advisor/chat/route");

function buildRequest(): NextRequest {
  return new NextRequest("https://example.test/api/advisor/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-id": "user-1",
    },
    body: JSON.stringify({
      messages: [{ sender: "user", text: "Where should I put 1000 NIS?" }],
    }),
  });
}

async function* emptyStream(): AsyncGenerator<string> {}

async function readFrames(response: Response): Promise<AdvisorStreamFrame[]> {
  const text = await response.text();
  return text
    .split(FRAME_SEPARATOR)
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => decodeFrame(`${chunk}${FRAME_SEPARATOR}`.trimEnd()))
    .filter((frame): frame is AdvisorStreamFrame => frame !== null);
}

describe("POST /api/advisor/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * A plan a tool call already computed is real and worth the client having
   * even when a later agent step (the final text) is what actually failed —
   * regression for discarding it when `run.error` was checked before the
   * recorder's plans were flushed.
   */
  it("flushes a plan the run already computed before surfacing a later run error", async () => {
    const plan = {
      status: "planned" as const,
      contributionNis: 1_000,
      investableValueNis: 5_000,
      byAssetClass: [],
      byHolding: [],
      dropped: [],
    };
    streamAdvisorResponse.mockImplementation(
      async (_messages, _userId, recorder: AdvisorTurnRecorder) => {
        recorder.recordPlan(plan);
        return { textStream: emptyStream(), error: new Error("boom") };
      }
    );

    const response = await POST(buildRequest());
    const frames = await readFrames(response);

    const planFrameIndex = frames.findIndex((frame) => frame.type === "plan");
    const errorFrameIndex = frames.findIndex((frame) => frame.type === "error");

    expect(planFrameIndex).toBeGreaterThanOrEqual(0);
    expect(errorFrameIndex).toBeGreaterThanOrEqual(0);
    expect(planFrameIndex).toBeLessThan(errorFrameIndex);
    expect(frames.some((frame) => frame.type === "done")).toBe(false);
  });

  it("still sends done with no error frame when the run succeeds", async () => {
    streamAdvisorResponse.mockResolvedValue({
      textStream: emptyStream(),
      error: undefined,
    });

    const response = await POST(buildRequest());
    const frames = await readFrames(response);

    expect(frames.map((frame) => frame.type)).toEqual(["done"]);
  });

  // The error frame now goes through `safeEnqueue`, same as every other
  // frame (route.ts), so a client that disconnects between the abort check
  // and the enqueue call cannot throw out of `start()`. Not covered by a
  // test here: forcing that exact race — the controller already errored by
  // an external cancel, landing between the `abortSignal.aborted` check and
  // the enqueue call — did not reproduce deterministically against Vitest's
  // Node streams implementation (an empty mocked textStream reaches the
  // enqueue before an injected `reader.cancel()` takes effect, and the
  // Streams spec has `start()`'s own rejection handling absorb a throw
  // there rather than surfacing it as a Node `unhandledRejection`). Verified
  // by inspection instead: the error-frame enqueue is now textually the same
  // safeEnqueue(controller, ...) shape as the delta/plan/done frames it sits
  // beside, which are already exercised above.
});
