import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FxRateProvider } from "@/lib/providers/FxRateProvider";
import { mockFetch } from "@/lib/providers/__tests__/mockFetch";

vi.mock("@/lib/redis", () => ({
  generateMarketDataKey: (symbol: string, type: string) =>
    `market_data:${type}:${symbol.toLowerCase()}`,
  getCachedData: async () => null,
  setCachedData: async () => undefined,
}));

describe("FxRateProvider", () => {
  beforeEach(() => {
    mockFetch({ rates: { ILS: 3.0541 } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for the rate against ILS using the given currency as the base", async () => {
    await new FxRateProvider().getRateToNis("EUR");
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("base=EUR");
    expect(url).toContain("symbols=ILS");
  });

  it("returns the rate the API quoted rather than deriving it", async () => {
    mockFetch({ rates: { ILS: 3.4666 } });
    const rate = await new FxRateProvider().getRateToNis("EUR");
    expect(rate.price).toBe(3.4666);
    expect(rate.currency).toBe("NIS");
  });

  it("refuses to price NIS against itself rather than requesting a base Frankfurter does not know", async () => {
    await expect(new FxRateProvider().getRateToNis("NIS")).rejects.toThrow(
      /NIS/
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws naming the currency and status when the request fails", async () => {
    mockFetch({}, false, 502);
    await expect(new FxRateProvider().getRateToNis("USD")).rejects.toThrow(
      /USD[\s\S]*502/
    );
  });

  it("throws rather than treating a missing rate as zero", async () => {
    mockFetch({ rates: {} });
    await expect(new FxRateProvider().getRateToNis("USD")).rejects.toThrow(
      /USD/
    );
  });
});
