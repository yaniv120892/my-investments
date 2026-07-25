import { afterEach, describe, expect, it, vi } from "vitest";
import { FinnhubProvider } from "@/lib/providers/FinnhubProvider";

function mockFetch(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  );
}

describe("FinnhubProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a USD quote from the current-price field", async () => {
    mockFetch({ c: 742.36 });
    const quote = await new FinnhubProvider("key").fetchQuote("IVV");
    expect(quote.price).toBe(742.36);
    expect(quote.currency).toBe("USD");
    expect(quote.source).toBe("Finnhub");
  });

  it("throws naming the symbol when the response is not ok", async () => {
    mockFetch({}, false, 429);
    await expect(new FinnhubProvider("key").fetchQuote("IVV")).rejects.toThrow(
      /IVV[\s\S]*429/
    );
  });

  it("throws when the price is zero, which Finnhub returns for unknown symbols", async () => {
    mockFetch({ c: 0 });
    await expect(
      new FinnhubProvider("key").fetchQuote("NOPE")
    ).rejects.toThrow(/NOPE/);
  });

  it("throws when the price field is absent", async () => {
    mockFetch({ d: null });
    await expect(new FinnhubProvider("key").fetchQuote("IVV")).rejects.toThrow(
      /IVV/
    );
  });

  it("throws when no API key is configured", async () => {
    await expect(new FinnhubProvider("").fetchQuote("IVV")).rejects.toThrow(
      /FINNHUB_API_KEY/
    );
  });
});
