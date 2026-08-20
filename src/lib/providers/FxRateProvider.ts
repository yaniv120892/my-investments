import { MarketData } from "@/types";
import {
  generateMarketDataKey,
  getCachedData,
  setCachedData,
} from "@/lib/redis";
import type { SupportedCurrency } from "@/lib/pricing/supportedCurrencies";

const FX_RATE_URL = "https://api.frankfurter.dev/v1/latest";

/**
 * This app calls the shekel NIS; every FX API calls it ILS. The mapping has to
 * apply to whichever side of the pair a currency appears on, or the next
 * currency whose internal name diverges from its ISO code fails at runtime
 * instead of here.
 */
const ISO_CODES: Record<SupportedCurrency, string> = {
  NIS: "ILS",
  USD: "USD",
  EUR: "EUR",
};

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
    const url = `${FX_RATE_URL}?base=${ISO_CODES[currency]}&symbols=${
      ISO_CODES.NIS
    }`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `${currency}/NIS rate request failed (url: ${url}, status: ${response.status})`
      );
    }

    const data: { rates?: Record<string, number> } = await response.json();
    const rate = data?.rates?.[ISO_CODES.NIS];

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
