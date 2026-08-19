import { PriceSource } from "@prisma/client";
import { BROWSER_USER_AGENT } from "@/lib/providers/browserUserAgent";
import {
  SUPPORTED_CURRENCIES,
  isSupportedCurrency,
} from "@/lib/pricing/supportedCurrencies";
import type { SupportedCurrency } from "@/lib/pricing/supportedCurrencies";
import type { PriceProvider, Quote } from "@/lib/providers/types";

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_CHART_QUERY = "interval=1d&range=1d";

interface YahooChartMeta {
  regularMarketPrice?: number;
  currency?: string;
}

interface YahooChartResponse {
  chart?: {
    result?: { meta?: YahooChartMeta }[];
    error?: unknown;
  };
}

export class YahooProvider implements PriceProvider {
  public readonly source = PriceSource.YAHOO;

  public async fetchQuote(sourceSymbol: string): Promise<Quote> {
    const url = `${YAHOO_CHART_URL}/${encodeURIComponent(
      sourceSymbol
    )}?${YAHOO_CHART_QUERY}`;
    const response = await fetch(url, {
      headers: { "User-Agent": BROWSER_USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(
        `Yahoo quote request failed (symbol: ${sourceSymbol}, status: ${response.status}, url: ${url})`
      );
    }

    const data: YahooChartResponse = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;

    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
      throw new Error(
        `Yahoo returned no usable price (symbol: ${sourceSymbol}, received: ${JSON.stringify(
          data?.chart?.error ?? meta ?? null
        )})`
      );
    }

    return {
      price,
      currency: this.toSupportedCurrency(sourceSymbol, meta?.currency),
      fetchedAt: new Date(),
      source: "Yahoo Finance",
    };
  }

  /**
   * Guards against the sub-unit trap: a London line can be quoted in GBp, a
   * hundredth of the GBP its ticker implies, and silently treating that as GBP
   * would undervalue the holding a hundredfold. Yahoo's Tel Aviv quotes carry
   * the same shekel-or-agorot ambiguity, which is why an ILS quote is refused
   * here rather than aliased to NIS — TASE securities are priced through Maya,
   * where the unit is known. Only an exact match is accepted.
   */
  private toSupportedCurrency(
    sourceSymbol: string,
    yahooCurrency: string | undefined
  ): SupportedCurrency {
    if (yahooCurrency === undefined || !isSupportedCurrency(yahooCurrency)) {
      throw new Error(
        `Yahoo quoted ${sourceSymbol} in a currency this portfolio cannot convert to NIS (received: ${yahooCurrency}, supported: ${SUPPORTED_CURRENCIES.join(
          ", "
        )}); use a listing quoted in one of those, or price it through Maya`
      );
    }

    return yahooCurrency;
  }
}

export const yahooProvider = new YahooProvider();
