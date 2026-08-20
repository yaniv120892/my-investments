import type { PriceSource } from "@prisma/client";
import {
  generateMarketDataKey,
  getCachedData,
  setCachedData,
} from "@/lib/redis";
import type { SupportedCurrency } from "@/lib/pricing/supportedCurrencies";
import type { PriceProvider, Quote } from "@/lib/providers/types";

/** A quote as it comes back out of Redis, where Date has become an ISO string. */
interface CachedQuote {
  price: number;
  currency: SupportedCurrency;
  fetchedAt: string;
  source: string;
}

/**
 * /api/holdings prices the entire portfolio on every dashboard load, and none of
 * the upstreams tolerate that: Maya sits behind a WAF that reads bursts as
 * scraping, and Finnhub's free tier caps at sixty a minute. Sharing the FX
 * cache's one-hour TTL collapses any number of refreshes within an hour into a
 * single call per symbol. Redis failures fall through to a live fetch —
 * getCachedData swallows them. Failures are deliberately not cached, so a
 * recovered upstream is picked up immediately rather than after the TTL; the
 * cost is that an upstream outage leaves a holding with no price at all rather
 * than a stale one, which is what turns a bad provider day into a skipped
 * snapshot.
 */
export class CachedPriceProvider implements PriceProvider {
  public readonly source: PriceSource;

  public constructor(private readonly provider: PriceProvider) {
    this.source = provider.source;
  }

  public async fetchQuote(sourceSymbol: string): Promise<Quote> {
    const cacheKey = generateMarketDataKey(
      sourceSymbol,
      `quote:${this.provider.source}`
    );

    const cached = await getCachedData<CachedQuote>(cacheKey);
    if (cached) {
      return { ...cached, fetchedAt: new Date(cached.fetchedAt) };
    }

    const quote = await this.provider.fetchQuote(sourceSymbol);
    await setCachedData(cacheKey, quote);
    return quote;
  }
}
