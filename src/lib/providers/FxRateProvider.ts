import { MarketData } from "@/types";
import {
  generateMarketDataKey,
  getCachedData,
  setCachedData,
} from "@/lib/redis";

const FX_RATE_URL = "https://api.frankfurter.dev/v1/latest";

export class FxRateProvider {
  public async getUsdToNisRate(): Promise<MarketData> {
    const cacheKey = generateMarketDataKey("usd", "currency");

    const cached = await getCachedData<MarketData>(cacheKey);
    if (cached) {
      return cached;
    }

    const rate = await this.fetchUsdToNisRate();
    const marketData: MarketData = {
      price: rate,
      currency: "NIS",
      lastUpdated: new Date(),
      source: "Frankfurter",
    };

    await setCachedData(cacheKey, marketData);
    return marketData;
  }

  private async fetchUsdToNisRate(): Promise<number> {
    const url = `${FX_RATE_URL}?base=USD&symbols=ILS`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `USD/NIS rate request failed (url: ${url}, status: ${response.status})`
      );
    }

    const data: { rates?: { ILS?: number } } = await response.json();
    const rate = data?.rates?.ILS;

    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(
        `USD/NIS rate missing or invalid (url: ${url}, received: ${JSON.stringify(
          data
        )})`
      );
    }

    return rate;
  }
}

export const fxRateProvider = new FxRateProvider();
