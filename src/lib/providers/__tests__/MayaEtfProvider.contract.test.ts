import { describe, expect, it } from "vitest";
import { MayaEtfProvider } from "@/lib/providers/MayaEtfProvider";
import { MayaFundProvider } from "@/lib/providers/MayaFundProvider";

/**
 * The tripwire for mayaapi's hotlink filter changing: it 403s any request whose
 * headers do not look like maya.tase.co.il's own front end, so this failing
 * means the header set in mayaApi needs revisiting, not that these securities
 * stopped existing.
 *
 * The ranges are wide enough to sit out ordinary market moves and narrow enough
 * to catch the failure that actually matters — a rate read as shekels instead
 * of agorot, which would misprice the portfolio by a hundred without erroring.
 */
describe("MayaEtfProvider contract", () => {
  const provider = new MayaEtfProvider();

  it.each([
    { fundId: "1159250", name: "iShares Core S&P 500", min: 1000, max: 6000 },
    { fundId: "1159169", name: "iShares Core MSCI EM IMI", min: 50, max: 500 },
    { fundId: "1159094", name: "iShares Core MSCI Europe", min: 100, max: 1200 },
  ])("prices $fundId — $name in NIS", async ({ fundId, min, max }) => {
    const quote = await provider.fetchQuote(fundId);
    expect(quote.currency).toBe("NIS");
    expect(quote.price).toBeGreaterThan(min);
    expect(quote.price).toBeLessThan(max);
  });

  it("rejects a security id that does not exist", async () => {
    await expect(provider.fetchQuote("9999999")).rejects.toThrow();
  });

  /**
   * The reason each Maya product gets its own PriceSource. Neither endpoint
   * serves the other's ids, and it refuses them with the same 403 it uses to
   * turn away a blocked client — so a provider that fell back between the two
   * could not tell a wrong id from being throttled.
   */
  it("does not serve mutual fund ids, and the fund endpoint does not serve its own", async () => {
    await expect(provider.fetchQuote("5109889")).rejects.toThrow();
    await expect(
      new MayaFundProvider().fetchQuote("1159250")
    ).rejects.toThrow();
  });
});
