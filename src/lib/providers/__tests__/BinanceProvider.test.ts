import { afterEach, describe, expect, it, vi } from "vitest";
import { BinanceProvider } from "@/lib/providers/BinanceProvider";
import { fetchCall, mockFetch } from "@/lib/providers/__tests__/mockFetch";

describe("BinanceProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a USD quote parsed from the string price", async () => {
    mockFetch({ symbol: "BTCUSDT", price: "64205.03000000" });
    const quote = await new BinanceProvider().fetchQuote("BTC");
    expect(quote.price).toBeCloseTo(64205.03);
    expect(quote.currency).toBe("USD");
    expect(quote.source).toBe("Binance");
  });

  it.each([
    ["BTC", "BTCUSDT"],
    ["btc", "BTCUSDT"],
    ["BTCUSDT", "BTCUSDT"],
    ["BTCUSD", "BTCUSDT"],
    ["1INCH", "1INCHUSDT"],
    ["BTC - קריפטו", "BTCUSDT"],
  ])("normalises %s to the pair %s", async (input, expected) => {
    mockFetch({ price: "1.0" });
    await new BinanceProvider().fetchQuote(input);
    expect(fetchCall()[0]).toContain(expected);
  });

  it("names the region as the cause when Binance replies 451", async () => {
    mockFetch({}, false, 451);

    await expect(new BinanceProvider().fetchQuote("BTC")).rejects.toThrow(
      /refuses requests from this server's region.*BTCUSDT.*451/
    );
  });

  it("throws naming the pair when the response is not ok", async () => {
    mockFetch({}, false, 400);
    await expect(new BinanceProvider().fetchQuote("NOPE")).rejects.toThrow(
      /NOPEUSDT[\s\S]*400/
    );
  });

  it("throws when the price is not parseable", async () => {
    mockFetch({ price: "not-a-number" });
    await expect(new BinanceProvider().fetchQuote("BTC")).rejects.toThrow(
      /BTCUSDT/
    );
  });
});
