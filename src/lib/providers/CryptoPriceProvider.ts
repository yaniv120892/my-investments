import { MarketData } from "@/types";
import {
  generateMarketDataKey,
  getCachedData,
  setCachedData,
} from "@/lib/redis";

export class CryptoPriceProvider {
  public async getPrice(symbol: string): Promise<MarketData | null> {
    const cacheKey = generateMarketDataKey(symbol, "crypto");

    const cached = await getCachedData<MarketData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const pair = this.normalizeToBinancePair(symbol);
      const response = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(
          pair
        )}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: { symbol?: string; price?: string } = await response.json();
      const parsed =
        typeof data?.price === "string" ? parseFloat(data.price) : NaN;
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Missing or invalid Binance price for ${pair}`);
      }

      const marketData: MarketData = {
        price: parsed,
        currency: "USD",
        lastUpdated: new Date(),
        source: "Binance",
      };

      await setCachedData(cacheKey, marketData);
      return marketData;
    } catch (error) {
      console.warn(
        `Warning: Unable to fetch crypto price for symbol ${symbol}:`,
        error
      );
      return null;
    }
  }

  private normalizeToBinancePair(symbol: string): string {
    const ticker = String(symbol)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (ticker.endsWith("USDT")) return ticker;
    if (ticker.endsWith("USD")) return ticker.replace(/USD$/, "USDT");
    return `${ticker}USDT`;
  }
}

export const cryptoPriceProvider = new CryptoPriceProvider();
