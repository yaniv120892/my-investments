import { vi } from "vitest";

/** Replaces global fetch with a stub returning one JSON body. */
export function mockFetch(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  );
}

/** The arguments the stubbed fetch was called with, for asserting url and headers. */
export function fetchCall(index = 0): [string, RequestInit | undefined] {
  const [url, options] = vi.mocked(fetch).mock.calls[index];
  return [String(url), options];
}
