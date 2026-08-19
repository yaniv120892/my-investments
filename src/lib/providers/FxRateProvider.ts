import { MarketData } from "@/types";
import {
  generateMarketDataKey,
  getCachedData,
  setCachedData,
} from "@/lib/redis";
import type { SupportedCurrency } from "@/lib/pricing/supportedCurrencies";

const FX_RATE_URL = "https://api.frankfurter.dev/v1/latest";
const NIS_ISO_CODE = "ILS";

export class FxRateProvider {
  public async getRateToNis(
    currency: SupportedCurrency
  ): Promise<MarketData> {
    this.assertIsForeignCurrency(currency);

    const cacheKey = generateMarketDataKey(currency, "currency");

    const cached = await getCachedData<MarketData>(cacheKey);
    if (cached) {
      return cached;
    }

    const rate = await this.fetchRateToNis(currency);
    const marketData: MarketData = {
      price: rate,
      currency: "NIS",
      lastUpdated: new Date(),
      source: "Frankfurter",
    };

    await setCachedData(cacheKey, marketData);
    return marketData;
  }

  private assertIsForeignCurrency(currency: SupportedCurrency): void {
    if (currency === "NIS") {
      throw new Error(
        "NIS needs no conversion to NIS; ask the rate book for the rate instead of the FX provider"
      );
    }
  }

  private async fetchRateToNis(currency: SupportedCurrency): Promise<number> {
    const url = `${FX_RATE_URL}?base=${currency}&symbols=${NIS_ISO_CODE}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `${currency}/NIS rate request failed (url: ${url}, status: ${response.status})`
      );
    }

    const data: { rates?: { ILS?: number } } = await response.json();
    const rate = data?.rates?.ILS;

    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(
        `${currency}/NIS rate missing or invalid (url: ${url}, received: ${JSON.stringify(
          data
        )})`
      );
    }

    return rate;
  }
}

export const fxRateProvider = new FxRateProvider();
