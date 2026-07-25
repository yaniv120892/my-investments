import { describe, expect, it } from "vitest";
import { BinanceProvider } from "@/lib/providers/BinanceProvider";

const HELD_COINS = [
  "BTC",
  "ETH",
  "ADA",
  "1INCH",
  "SHIB",
  "BNB",
  "DOGE",
  "DOT",
  "CAKE",
  "MATIC",
  "SOL",
  "DAR",
  "POL",
];

describe("BinanceProvider contract", () => {
  const provider = new BinanceProvider();

  it.each(HELD_COINS)("prices %s", async (symbol) => {
    const quote = await provider.fetchQuote(symbol);
    expect(quote.currency).toBe("USD");
    expect(quote.price).toBeGreaterThan(0);
  });

  it("rejects an unknown pair", async () => {
    await expect(provider.fetchQuote("ZZZZNOTREAL")).rejects.toThrow();
  });
});
