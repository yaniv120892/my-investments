import { describe, expect, it } from "vitest";
import { YahooProvider } from "@/lib/providers/YahooProvider";
import type { Quote } from "@/lib/providers/types";

const RATE_LIMITED = /status: 429/;
const RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 2500;

const provider = new YahooProvider();

/**
 * Yahoo throttles by IP in bursts: three symbols fetched back to back will trip
 * it where one would not, and being throttled says nothing about whether the
 * contract still holds. Backing off keeps this a real tripwire — a 404, a
 * renamed field or a changed currency still fails it — without going red because
 * the machine running it asked too quickly.
 */
async function fetchQuoteBackingOffWhenThrottled(
  symbol: string
): Promise<Quote> {
  let lastError: unknown;

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await provider.fetchQuote(symbol);
    } catch (error) {
      lastError = error;
      const isThrottled = error instanceof Error && RATE_LIMITED.test(error.message);
      if (!isThrottled) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
    }
  }

  throw lastError;
}

async function isThrottledHere(): Promise<boolean> {
  try {
    await fetchQuoteBackingOffWhenThrottled("CSPX.L");
    return false;
  } catch (error) {
    return error instanceof Error && RATE_LIMITED.test(error.message);
  }
}

/**
 * A skipped run is not a passing run: it means this IP is throttled, so verify
 * from somewhere else before trusting a change to YahooProvider.
 */
const isThrottled = await isThrottledHere();

describe.skipIf(isThrottled)("YahooProvider contract", () => {
  it.each([
    ["CSPX.L", "iShares Core S&P 500 UCITS", "USD", 100, 5000],
    ["EIMI.L", "iShares Core MSCI EM IMI UCITS", "USD", 10, 500],
    ["IMAE.AS", "iShares Core MSCI Europe UCITS", "EUR", 10, 1000],
  ])("prices %s — %s", async (symbol, _name, currency, low, high) => {
    const quote = await fetchQuoteBackingOffWhenThrottled(symbol);
    expect(quote.currency).toBe(currency);
    expect(quote.price).toBeGreaterThan(low);
    expect(quote.price).toBeLessThan(high);
  });

  it("rejects a symbol that does not exist rather than returning zero", async () => {
    await expect(provider.fetchQuote("ZZZZNOTREAL.L")).rejects.toThrow();
  });
});
