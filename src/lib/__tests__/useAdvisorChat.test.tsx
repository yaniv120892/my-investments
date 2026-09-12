// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAdvisorChat } from "@/lib/useAdvisorChat";
import { streamAdvisorMessage } from "@/lib/advisorStream";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/advisorStream", () => ({
  streamAdvisorMessage: vi.fn(),
}));

describe("useAdvisorChat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aborts the in-flight stream when the component unmounts", () => {
    // A stalled fetch/reader must not keep running against a discarded
    // closure once the user has navigated away from /advisor.
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(streamAdvisorMessage).mockImplementation(
      (_messages, _handlers, signal) => {
        capturedSignal = signal;
        return new Promise(() => {}); // never resolves: a stalled stream
      }
    );

    const { result, unmount } = renderHook(() => useAdvisorChat());

    act(() => {
      void result.current.sendMessage("How much should I invest?");
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });
});
