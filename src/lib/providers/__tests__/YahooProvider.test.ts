import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YahooProvider } from "@/lib/providers/YahooProvider";

const FIXTURES = join(__dirname, "fixtures");
const usdChart = JSON.parse(
  readFileSync(join(FIXTURES, "yahoo-cspx-usd.json"), "utf8")
);
const eurChart = JSON.parse(
  readFileSync(join(FIXTURES, "yahoo-imae-eur.json"), "utf8")
);

function mockFetch(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  );
}

function chartWithCurrency(currency: string): unknown {
  return {
    chart: {
      result: [{ meta: { regularMarketPrice: 100, currency } }],
    },
  };
}

describe("YahooProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the regular market price of a USD-quoted London listing", async () => {
    mockFetch(usdChart);
    const quote = await new YahooProvider().fetchQuote("CSPX.L");
    expect(quote.currency).toBe("USD");
    expect(quote.source).toBe("Yahoo Finance");
    expect(quote.price).toBeGreaterThan(100);
    expect(quote.price).toBeLessThan(5000);
  });

  it("keeps a EUR-quoted Amsterdam listing in EUR rather than assuming USD", async () => {
    mockFetch(eurChart);
    const quote = await new YahooProvider().fetchQuote("IMAE.AS");
    expect(quote.currency).toBe("EUR");
    expect(quote.price).toBeGreaterThan(10);
    expect(quote.price).toBeLessThan(1000);
  });

  it("refuses a pence-quoted listing instead of undervaluing it a hundredfold", async () => {
    mockFetch(chartWithCurrency("GBp"));
    await expect(new YahooProvider().fetchQuote("VUSA.L")).rejects.toThrow(
      /GBp/
    );
  });

  it("refuses an ILS quote rather than guessing between shekels and agorot", async () => {
    mockFetch(chartWithCurrency("ILS"));
    await expect(new YahooProvider().fetchQuote("TASE.TA")).rejects.toThrow(
      /ILS/
    );
  });

  it("throws naming the symbol and status when the request fails", async () => {
    mockFetch({}, false, 404);
    await expect(new YahooProvider().fetchQuote("ZZZZ.L")).rejects.toThrow(
      /ZZZZ\.L[\s\S]*404/
    );
  });

  it("throws rather than returning zero when the price is missing", async () => {
    mockFetch({ chart: { result: [{ meta: { currency: "USD" } }] } });
    await expect(new YahooProvider().fetchQuote("CSPX.L")).rejects.toThrow(
      /CSPX\.L/
    );
  });

  it("throws when the response carries no result at all", async () => {
    mockFetch({ chart: { result: [], error: { code: "Not Found" } } });
    await expect(new YahooProvider().fetchQuote("CSPX.L")).rejects.toThrow(
      /CSPX\.L/
    );
  });
});
