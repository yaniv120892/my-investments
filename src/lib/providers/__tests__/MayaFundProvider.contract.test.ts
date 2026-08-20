import { describe, expect, it } from "vitest";
import { MayaFundProvider } from "@/lib/providers/MayaFundProvider";

describe("MayaFundProvider contract", () => {
  const provider = new MayaFundProvider();

  it('prices 5109889 — MTF מחקה ת"א 125', async () => {
    const quote = await provider.fetchQuote("5109889");
    expect(quote.currency).toBe("NIS");
    expect(quote.price).toBeGreaterThan(1);
    expect(quote.price).toBeLessThan(100);
  });

  it("rejects a fund id that does not exist", async () => {
    await expect(provider.fetchQuote("9999999")).rejects.toThrow();
  });
});
