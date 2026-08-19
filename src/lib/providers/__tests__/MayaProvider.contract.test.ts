import { describe, expect, it } from "vitest";
import { MayaProvider } from "@/lib/providers/MayaProvider";

describe("MayaProvider contract", () => {
  const provider = new MayaProvider();

  /**
   * The tripwire for mayaapi's hotlink filter changing: it 403s any request
   * whose headers do not look like maya.tase.co.il's own front end, so this
   * failing means the header set in MayaProvider needs revisiting, not that
   * the fund stopped existing.
   */
  it("prices 5109889 — MTF מחקה ת\"א 125", async () => {
    const quote = await provider.fetchQuote("5109889");
    expect(quote.currency).toBe("NIS");
    expect(quote.price).toBeGreaterThan(1);
    expect(quote.price).toBeLessThan(100);
  });

  it("rejects a fund id that does not exist", async () => {
    await expect(provider.fetchQuote("9999999")).rejects.toThrow();
  });
});
