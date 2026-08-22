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

const { CachedPriceProvider } =
  await import("@/lib/providers/CachedPriceProvider");

const fetchQuote = vi.fn();

const upstream: PriceProvider = {
  source: PriceSource.MAYA_ETF,
  fetchQuote,
};

function quoteFixture(): Quote {
  return {
    price: 2476.4,
    currency: "NIS",
    fetchedAt: new Date("2026-08-19T20:00:00.000Z"),
    source: "Maya (TASE)",
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
    expect(new CachedPriceProvider(upstream).source).toBe(PriceSource.MAYA_ETF);
  });

  it("fetches and caches on a miss", async () => {
    const quote = await new CachedPriceProvider(upstream).fetchQuote("1159250");
    expect(quote.price).toBe(2476.4);
    expect(fetchQuote).toHaveBeenCalledTimes(1);
    expect(setCachedData).toHaveBeenCalledWith(
      "market_data:quote:MAYA_ETF:1159250",
      quoteFixture()
    );
  });

  it("serves a hit without calling the upstream at all", async () => {
    getCachedData.mockResolvedValue({
      price: 2470,
      currency: "NIS",
      fetchedAt: "2026-08-19T20:00:00.000Z",
      source: "Maya (TASE)",
    });
    const quote = await new CachedPriceProvider(upstream).fetchQuote("1159250");
    expect(quote.price).toBe(2470);
    expect(fetchQuote).not.toHaveBeenCalled();
  });

  it("revives fetchedAt as a Date, which Redis returns as a string", async () => {
    getCachedData.mockResolvedValue({
      price: 2470,
      currency: "NIS",
      fetchedAt: "2026-08-19T20:00:00.000Z",
      source: "Maya (TASE)",
    });
    const quote = await new CachedPriceProvider(upstream).fetchQuote("1159250");
    expect(quote.fetchedAt).toBeInstanceOf(Date);
    expect(quote.fetchedAt.toISOString()).toBe("2026-08-19T20:00:00.000Z");
  });

  it("keys separately per source, so two providers cannot collide on a symbol", async () => {
    await new CachedPriceProvider(upstream).fetchQuote("5109889");
    await new CachedPriceProvider({
      source: PriceSource.MAYA_FUND,
      fetchQuote,
    }).fetchQuote("5109889");

    const keys = getCachedData.mock.calls.map(([key]) => key);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("does not cache a failed fetch", async () => {
    fetchQuote.mockRejectedValue(
      new Error("Maya request failed (status: 403)")
    );
    await expect(
      new CachedPriceProvider(upstream).fetchQuote("1159250")
    ).rejects.toThrow(/403/);
    expect(setCachedData).not.toHaveBeenCalled();
  });
});
