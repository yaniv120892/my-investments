import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BizportalProvider } from "@/lib/providers/BizportalProvider";

const FIXTURES = join(__dirname, "fixtures");
const tradedHtml = readFileSync(join(FIXTURES, "bizportal-traded.html"), "utf8");
const mutualHtml = readFileSync(join(FIXTURES, "bizportal-mutual.html"), "utf8");

function mockFetch(html: string, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, text: async () => html })
  );
}

describe("BizportalProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a traded fund and converts agorot to NIS", async () => {
    mockFetch(tradedHtml);
    const quote = await new BizportalProvider().fetchQuote("1159250");
    expect(quote.currency).toBe("NIS");
    expect(quote.source).toBe("Bizportal");
    expect(quote.price).toBeGreaterThan(1000);
    expect(quote.price).toBeLessThan(5000);
  });

  it("takes the closing rate, not the base rate, for a traded fund", async () => {
    mockFetch(tradedHtml);
    const quote = await new BizportalProvider().fetchQuote("1159250");
    const baseRateAgorot = Number(
      /שער בסיס<\/dt><dd>([\d,]+)<\/dd>/
        .exec(tradedHtml)?.[1]
        ?.replace(/,/g, "") ?? "0"
    );
    expect(baseRateAgorot).toBeGreaterThan(0);
    expect(Math.round(quote.price * 100)).not.toBe(baseRateAgorot);
  });

  it("does not concatenate the percentage change into the price", async () => {
    mockFetch(tradedHtml);
    const quote = await new BizportalProvider().fetchQuote("1159250");
    expect(Number.isFinite(quote.price)).toBe(true);
    expect(quote.price).toBeGreaterThan(0);
  });

  it("parses a mutual fund redemption price and converts agorot to NIS", async () => {
    mockFetch(mutualHtml);
    const quote = await new BizportalProvider().fetchQuote("5109889");
    expect(quote.currency).toBe("NIS");
    expect(quote.price).toBeGreaterThan(1);
    expect(quote.price).toBeLessThan(100);
  });

  it("is not fooled by the empty top-area-cube on a traded fund page", async () => {
    mockFetch(tradedHtml);
    const quote = await new BizportalProvider().fetchQuote("1159250");
    expect(quote.price).toBeGreaterThan(1000);
  });

  it("throws naming the security when the request fails", async () => {
    mockFetch("", false, 500);
    await expect(
      new BizportalProvider().fetchQuote("1159250")
    ).rejects.toThrow(/1159250[\s\S]*500/);
  });

  it("throws when neither layout is recognised", async () => {
    mockFetch("<html><body>nothing useful here</body></html>");
    await expect(
      new BizportalProvider().fetchQuote("9999999")
    ).rejects.toThrow(/9999999/);
  });
});
