import { PriceSource } from "@prisma/client";
import type { Currency, PriceProvider, Quote } from "@/lib/providers/types";

const BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/price";
const BINANCE_CURRENCY: Currency = "USD";
const GEO_BLOCKED_STATUS = 451;

export class BinanceProvider implements PriceProvider {
  public readonly source = PriceSource.BINANCE;

  public async fetchQuote(sourceSymbol: string): Promise<Quote> {
    const pair = this.normalizeToBinancePair(sourceSymbol);
    const url = `${BINANCE_TICKER_URL}?symbol=${encodeURIComponent(pair)}`;
    const response = await fetch(url);

    if (response.status === GEO_BLOCKED_STATUS) {
      throw new Error(
        `Binance refuses requests from this server's region (pair: ${pair}, status: ${GEO_BLOCKED_STATUS}); deploy the pricing routes outside the US`
      );
    }

    if (!response.ok) {
      throw new Error(
        `Binance quote request failed (pair: ${pair}, status: ${response.status})`
      );
    }

    const data: { price?: string } = await response.json();
    const price = typeof data?.price === "string" ? parseFloat(data.price) : NaN;

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(
        `Binance returned no usable price (pair: ${pair}, received: ${JSON.stringify(
          data
        )})`
      );
    }

    return {
      price,
      currency: BINANCE_CURRENCY,
      fetchedAt: new Date(),
      source: "Binance",
    };
  }

  private normalizeToBinancePair(symbol: string): string {
    const ticker = String(symbol)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (ticker.endsWith("USDT")) {
      return ticker;
    }
    if (ticker.endsWith("USD")) {
      return ticker.replace(/USD$/, "USDT");
    }
    return `${ticker}USDT`;
  }
}

export const binanceProvider = new BinanceProvider();
