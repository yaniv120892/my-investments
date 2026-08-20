import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MayaEtfProvider } from "@/lib/providers/MayaEtfProvider";
import { fetchCall, mockFetch } from "@/lib/providers/__tests__/mockFetch";

const tradeData = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "maya-etf-1159250.json"), "utf8")
);

describe("MayaEtfProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks the traded fund endpoint, which is the only one serving security ids", async () => {
    mockFetch(tradeData);
    await new MayaEtfProvider().fetchQuote("1159250");
    expect(fetchCall()[0]).toBe(
      "https://mayaapi.tase.co.il/api/etf/tradedata?fundId=1159250"
    );
  });

  it("converts the last rate from agorot to NIS", async () => {
    mockFetch(tradeData);
    const quote = await new MayaEtfProvider().fetchQuote("1159250");
    expect(quote.price).toBeCloseTo(tradeData.LastRate / 100, 10);
  });

  /**
   * TASE quotes the cross-listed iShares funds in agorot even though they are
   * denominated in dollars or euros in London. Reading the rate as anything but
   * agorot would misprice the portfolio by a factor of a hundred, silently.
   */
  it("treats the rate as agorot, not as the fund's foreign denomination", async () => {
    mockFetch({ LastRate: 247640, ForeignMarket: "LONDON" });
    const quote = await new MayaEtfProvider().fetchQuote("1159250");
    expect(quote.price).toBeCloseTo(2476.4, 10);
    expect(quote.currency).toBe("NIS");
  });

  it("falls back to the base rate before the first deal of the day", async () => {
    mockFetch({ LastRate: 0, BaseRate: 248440 });
    const quote = await new MayaEtfProvider().fetchQuote("1159250");
    expect(quote.price).toBeCloseTo(2484.4, 10);
  });

  it("prefers the last rate over the base rate once trading has started", async () => {
    mockFetch({ LastRate: 247640, BaseRate: 248440 });
    const quote = await new MayaEtfProvider().fetchQuote("1159250");
    expect(quote.price).toBeCloseTo(2476.4, 10);
  });

  it("throws rather than pricing at zero when neither rate is usable", async () => {
    mockFetch({ SecurityName: "ISH.FRF SP 500", LastRate: 0, BaseRate: 0 });
    await expect(new MayaEtfProvider().fetchQuote("1159250")).rejects.toThrow(
      /1159250/
    );
  });
});
