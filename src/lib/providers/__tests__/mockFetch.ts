import { vi } from "vitest";

export function mockFetch(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  );
}

export function fetchCallArguments(
  index = 0
): [string, RequestInit | undefined] {
  const [url, options] = vi.mocked(fetch).mock.calls[index];
  return [String(url), options];
}
