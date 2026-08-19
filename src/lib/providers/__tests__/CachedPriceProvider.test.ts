import { beforeEach, describe, expect, it, vi } from "vitest";
import { PriceSource } from "@prisma/client";
import type { PriceProvider, Quote } from "@/lib/providers/types";

const getCachedData = vi.fn();
const setCachedData = vi.fn();

vi.mock("@/lib/redis", () => ({
  generateMarketDataKey: (symbol: string, type: string) =>
    `market_data:${type}:${symbol.toLowerCase()}`,
  getCachedData: (key: string) => getCachedData(key),
  setCachedData: (key: string, data: unknown) => setCachedData(key, data),
}));

const { CachedPriceProvider } = await import(
  "@/lib/providers/CachedPriceProvider"
);

const fetchQuote = vi.fn();

const upstream: PriceProvider = {
  source: PriceSource.YAHOO,
  fetchQuote,
};

function quoteFixture(): Quote {
  return {
    price: 832.79,
    currency: "USD",
    fetchedAt: new Date("2026-08-19T20:00:00.000Z"),
    source: "Yahoo Finance",
  };
}

describe("CachedPriceProvider", () => {
  beforeEach(() => {
    fetchQuote.mockReset();
    getCachedData.mockReset();
    setCachedData.mockReset();
    fetchQuote.mockResolvedValue(quoteFixture());
    getCachedData.mockResolvedValue(null);
  });

  it("reports the source of the provider it wraps", () => {
    expect(new CachedPriceProvider(upstream).source).toBe(PriceSource.YAHOO);
  });

  it("fetches and caches on a miss", async () => {
    const quote = await new CachedPriceProvider(upstream).fetchQuote("CSPX.L");
    expect(quote.price).toBe(832.79);
    expect(fetchQuote).toHaveBeenCalledTimes(1);
    expect(setCachedData).toHaveBeenCalledWith(
      "market_data:quote:YAHOO:cspx.l",
      quoteFixture()
    );
  });

  it("serves a hit without calling the upstream at all", async () => {
    getCachedData.mockResolvedValue({
      price: 830,
      currency: "USD",
      fetchedAt: "2026-08-19T20:00:00.000Z",
      source: "Yahoo Finance",
    });
    const quote = await new CachedPriceProvider(upstream).fetchQuote("CSPX.L");
    expect(quote.price).toBe(830);
    expect(fetchQuote).not.toHaveBeenCalled();
  });

  it("revives fetchedAt as a Date, which Redis returns as a string", async () => {
    getCachedData.mockResolvedValue({
      price: 830,
      currency: "USD",
      fetchedAt: "2026-08-19T20:00:00.000Z",
      source: "Yahoo Finance",
    });
    const quote = await new CachedPriceProvider(upstream).fetchQuote("CSPX.L");
    expect(quote.fetchedAt).toBeInstanceOf(Date);
    expect(quote.fetchedAt.toISOString()).toBe("2026-08-19T20:00:00.000Z");
  });

  it("keys separately per source, so two providers cannot collide on a symbol", async () => {
    await new CachedPriceProvider(upstream).fetchQuote("5109889");
    await new CachedPriceProvider({
      source: PriceSource.MAYA,
      fetchQuote,
    }).fetchQuote("5109889");

    const keys = getCachedData.mock.calls.map(([key]) => key);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("does not cache a failed fetch", async () => {
    fetchQuote.mockRejectedValue(new Error("429 Too Many Requests"));
    await expect(
      new CachedPriceProvider(upstream).fetchQuote("CSPX.L")
    ).rejects.toThrow(/429/);
    expect(setCachedData).not.toHaveBeenCalled();
  });
});
