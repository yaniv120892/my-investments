import { describe, expect, it } from "vitest";
import { BizportalProvider } from "@/lib/providers/BizportalProvider";

describe("BizportalProvider contract", () => {
  const provider = new BizportalProvider();

  it.each([
    ["1159250", "iShares CORE S&P 500 (traded)", 1000, 5000],
    ["1159094", "iShares CORE MSCI EUROPE (traded)", 100, 1000],
    ["1159169", "iShares CORE MSCI EM IMI (traded)", 50, 500],
    ["5109889", "TLV 125 (mutual fund)", 1, 100],
  ])("prices %s — %s", async (securityId, _name, low, high) => {
    const quote = await provider.fetchQuote(securityId);
    expect(quote.currency).toBe("NIS");
    expect(quote.price).toBeGreaterThan(low);
    expect(quote.price).toBeLessThan(high);
  });

  it("throws for a security number that does not exist", async () => {
    await expect(provider.fetchQuote("9999999")).rejects.toThrow();
  });
});
