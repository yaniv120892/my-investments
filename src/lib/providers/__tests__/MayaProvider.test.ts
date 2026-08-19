import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MayaProvider } from "@/lib/providers/MayaProvider";

const FIXTURES = join(__dirname, "fixtures");
const fundDetails = JSON.parse(
  readFileSync(join(FIXTURES, "maya-fund-5109889.json"), "utf8")
);

function mockFetch(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  );
}

describe("MayaProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("converts the unit value from agorot to NIS", async () => {
    mockFetch(fundDetails);
    const quote = await new MayaProvider().fetchQuote("5109889");
    expect(quote.currency).toBe("NIS");
    expect(quote.source).toBe("Maya (TASE)");
    expect(quote.price).toBeCloseTo(fundDetails.UnitValuePrice / 100, 10);
    expect(quote.price).toBeGreaterThan(1);
    expect(quote.price).toBeLessThan(100);
  });

  it("takes the unit value, not the purchase or sell price", async () => {
    mockFetch({ UnitValuePrice: 446.25, PurchasePrice: 999, SellPrice: 111 });
    const quote = await new MayaProvider().fetchQuote("5109889");
    expect(quote.price).toBeCloseTo(4.4625, 10);
  });

  it("sends the hotlink headers mayaapi requires", async () => {
    mockFetch(fundDetails);
    await new MayaProvider().fetchQuote("5109889");
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options?.headers).toMatchObject({
      Referer: "https://maya.tase.co.il/",
      "X-Maya-With": "allow",
    });
  });

  it("throws naming the fund and status when the request fails", async () => {
    mockFetch({}, false, 403);
    await expect(new MayaProvider().fetchQuote("5109889")).rejects.toThrow(
      /5109889[\s\S]*403/
    );
  });

  it("throws rather than pricing a fund at zero when the field is missing", async () => {
    mockFetch({ FundLongName: "MTF" });
    await expect(new MayaProvider().fetchQuote("5109889")).rejects.toThrow(
      /5109889/
    );
  });
});
