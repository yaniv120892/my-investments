import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamAdvisorMessage } from "@/lib/advisorStream";
import { encodeFrame } from "@/lib/advisor/advisorStreamProtocol";
import type { AdvisorStreamFrame } from "@/lib/advisor/advisorStreamProtocol";

function eventStream(chunks: Uint8Array[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

function framesOf(frames: AdvisorStreamFrame[]): Uint8Array[] {
  return frames.map(encodeFrame);
}

function handlers() {
  return {
    onDelta: vi.fn(),
    onPlan: vi.fn(),
    onError: vi.fn(),
    onSessionExpired: vi.fn(),
  };
}

describe("streamAdvisorMessage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("delivers each delta and stops cleanly on the done sentinel", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          eventStream(
            framesOf([
              { type: "delta", value: "Put " },
              { type: "delta", value: "₪50,000" },
              { type: "done" },
            ])
          )
        )
    );
    const sink = handlers();

    await streamAdvisorMessage([], sink, new AbortController().signal);

    expect(sink.onDelta.mock.calls.map(([delta]) => delta)).toEqual([
      "Put ",
      "₪50,000",
    ]);
    expect(sink.onError).not.toHaveBeenCalled();
  });

  it("reassembles a frame split across two network chunks", async () => {
    const whole = encodeFrame({ type: "delta", value: "split" });
    const split = [whole.slice(0, 9), whole.slice(9)];
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          eventStream([...split, encodeFrame({ type: "done" })])
        )
    );
    const sink = handlers();

    await streamAdvisorMessage([], sink, new AbortController().signal);

    expect(sink.onDelta).toHaveBeenCalledWith("split");
  });

  it("reports a stream that ends without the done sentinel as cut off", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          eventStream(framesOf([{ type: "delta", value: "half an ans" }]))
        )
    );
    const sink = handlers();

    await streamAdvisorMessage([], sink, new AbortController().signal);

    expect(sink.onError).toHaveBeenCalledWith(
      expect.stringContaining("cut off")
    );
  });

  it("does not also report a cut-off when the server sent an error frame", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          eventStream(
            framesOf([{ type: "error", message: "upstream said no" }])
          )
        )
    );
    const sink = handlers();

    await streamAdvisorMessage([], sink, new AbortController().signal);

    expect(sink.onError).toHaveBeenCalledTimes(1);
    expect(sink.onError).toHaveBeenCalledWith("upstream said no");
  });

  it("routes a 401 to the session-expired handler rather than parsing a body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    const sink = handlers();

    await streamAdvisorMessage([], sink, new AbortController().signal);

    expect(sink.onSessionExpired).toHaveBeenCalledTimes(1);
    expect(sink.onError).not.toHaveBeenCalled();
  });

  it("surfaces the server's message when the response is JSON, not a stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "no model configured" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    const sink = handlers();

    await streamAdvisorMessage([], sink, new AbortController().signal);

    expect(sink.onError).toHaveBeenCalledWith("no model configured");
  });
});
