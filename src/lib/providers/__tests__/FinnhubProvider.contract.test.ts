import { describe, expect, it } from "vitest";
import { FinnhubProvider } from "@/lib/providers/FinnhubProvider";

const apiKey = process.env.FINNHUB_API_KEY ?? "";

describe.skipIf(!apiKey)("FinnhubProvider contract", () => {
  const provider = new FinnhubProvider(apiKey);

  it.each([
    ["IVV", 100, 2000],
    ["QQQ", 100, 2000],
    ["DIA", 100, 2000],
    ["EEM", 10, 500],
    ["VNQ", 10, 500],
    ["BA", 20, 1000],
    ["DIS", 20, 1000],
  ])("prices %s within a sane range", async (symbol, low, high) => {
    const quote = await provider.fetchQuote(symbol);
    expect(quote.currency).toBe("USD");
    expect(quote.price).toBeGreaterThan(low);
    expect(quote.price).toBeLessThan(high);
  });

  it("rejects an unknown symbol rather than returning zero", async () => {
    await expect(provider.fetchQuote("ZZZZNOTREAL")).rejects.toThrow();
  });

  it("cannot price London-listed UCITS on the free tier, which is why they are manual", async () => {
    await expect(provider.fetchQuote("CSPX")).rejects.toThrow();
  });
});
