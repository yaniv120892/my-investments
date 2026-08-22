import { describe, expect, it } from "vitest";
import { MayaEtfProvider } from "@/lib/providers/MayaEtfProvider";
import { MayaFundProvider } from "@/lib/providers/MayaFundProvider";

/**
 * The tripwire for mayaapi's hotlink filter changing: it 403s any request whose
 * headers do not look like maya.tase.co.il's own front end, so a failure here
 * means the header set in mayaApi needs revisiting, not that these securities
 * stopped existing.
 *
 * Both providers are exercised from one file on purpose. Vitest runs files in
 * separate workers, so a file each would fire two concurrent bursts at a
 * WAF-protected host — the shape of request that cost this app its price feed
 * twice already.
 *
 * The ranges are wide enough to sit out ordinary market moves and narrow enough
 * to catch the failure that actually matters: a rate read as shekels instead of
 * agorot, which would misprice the portfolio by a hundred without erroring.
 */
describe("Maya contract", () => {
  const etfProvider = new MayaEtfProvider();
  const fundProvider = new MayaFundProvider();

  it.each([
    { fundId: "1159250", name: "iShares Core S&P 500", min: 1000, max: 6000 },
    { fundId: "1159169", name: "iShares Core MSCI EM IMI", min: 50, max: 500 },
    {
      fundId: "1159094",
      name: "iShares Core MSCI Europe",
      min: 100,
      max: 1200,
    },
  ])(
    "prices traded fund $fundId — $name in NIS",
    async ({ fundId, min, max }) => {
      const quote = await etfProvider.fetchQuote(fundId);
      expect(quote.currency).toBe("NIS");
      expect(quote.price).toBeGreaterThan(min);
      expect(quote.price).toBeLessThan(max);
    }
  );

  it('prices mutual fund 5109889 — MTF מחקה ת"א 125 in NIS', async () => {
    const quote = await fundProvider.fetchQuote("5109889");
    expect(quote.currency).toBe("NIS");
    expect(quote.price).toBeGreaterThan(1);
    expect(quote.price).toBeLessThan(100);
  });

  /**
   * The reason each Maya product gets its own PriceSource. Neither endpoint
   * serves the other's ids, and it refuses them with the same 403 it uses to
   * turn away a blocked client — so a provider that fell back between the two
   * could not tell a wrong id from being throttled. One case each covers both
   * an unknown id and a wrong-product id, since Maya answers them alike.
   */
  it("neither endpoint serves the other's ids", async () => {
    await expect(etfProvider.fetchQuote("5109889")).rejects.toThrow();
    await expect(fundProvider.fetchQuote("1159250")).rejects.toThrow();
  });
});
