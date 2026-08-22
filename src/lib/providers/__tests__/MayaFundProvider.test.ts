import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MayaFundProvider } from "@/lib/providers/MayaFundProvider";
import {
  fetchCallArguments,
  mockFetch,
} from "@/lib/providers/__tests__/mockFetch";

const fundDetails = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "maya-fund-5109889.json"), "utf8")
);

describe("MayaFundProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks the mutual fund endpoint, which is the only one serving fund ids", async () => {
    mockFetch(fundDetails);
    await new MayaFundProvider().fetchQuote("5109889");
    expect(fetchCallArguments()[0]).toBe(
      "https://mayaapi.tase.co.il/api/fund/details?fundId=5109889"
    );
  });

  it("converts the unit value from agorot to NIS", async () => {
    mockFetch(fundDetails);
    const quote = await new MayaFundProvider().fetchQuote("5109889");
    expect(quote.price).toBeCloseTo(fundDetails.UnitValuePrice / 100, 10);
  });

  it("takes the unit value, not the purchase or sell price", async () => {
    mockFetch({ UnitValuePrice: 446.25, PurchasePrice: 999, SellPrice: 111 });
    const quote = await new MayaFundProvider().fetchQuote("5109889");
    expect(quote.price).toBeCloseTo(4.4625, 10);
  });

  it("throws rather than pricing a fund at zero when the field is missing", async () => {
    mockFetch({ FundLongName: "MTF" });
    await expect(new MayaFundProvider().fetchQuote("5109889")).rejects.toThrow(
      /5109889/
    );
  });
});
