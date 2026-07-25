import { afterEach, describe, expect, it, vi } from "vitest";
import { BinanceProvider } from "@/lib/providers/BinanceProvider";

function mockFetch(
  body: unknown,
  ok = true,
  status = 200
): ReturnType<typeof vi.fn> {
  const spy = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  vi.stubGlobal("fetch", spy);
  return spy;
}

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
    const spy = mockFetch({ price: "1.0" });
    await new BinanceProvider().fetchQuote(input);
    expect(spy.mock.calls[0][0]).toContain(expected);
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
