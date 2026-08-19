import { describe, expect, it } from "vitest";
import { YahooProvider } from "@/lib/providers/YahooProvider";

describe("YahooProvider contract", () => {
  const provider = new YahooProvider();

  it.each([
    ["CSPX.L", "iShares Core S&P 500 UCITS", "USD", 100, 5000],
    ["EIMI.L", "iShares Core MSCI EM IMI UCITS", "USD", 10, 500],
    ["IMAE.AS", "iShares Core MSCI Europe UCITS", "EUR", 10, 1000],
  ])("prices %s — %s", async (symbol, _name, currency, low, high) => {
    const quote = await provider.fetchQuote(symbol);
    expect(quote.currency).toBe(currency);
    expect(quote.price).toBeGreaterThan(low);
    expect(quote.price).toBeLessThan(high);
  });

  it("rejects a symbol that does not exist rather than returning zero", async () => {
    await expect(provider.fetchQuote("ZZZZNOTREAL.L")).rejects.toThrow();
  });
});
