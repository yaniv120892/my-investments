import { fxRateProvider } from "@/lib/providers/FxRateProvider";
import {
  SUPPORTED_CURRENCIES,
  isSupportedCurrency,
} from "@/lib/pricing/supportedCurrencies";
import type { SupportedCurrency } from "@/lib/pricing/supportedCurrencies";
import type { RateToNisSource } from "@/lib/pricing/nisRateBook.types";

export type { RateToNisSource } from "@/lib/pricing/nisRateBook.types";

const NIS_TO_NIS_RATE = 1;

/**
 * Memoises each currency's rate for the life of one pricing run, so a portfolio
 * holding twenty USD positions still costs one FX request.
 */
export class NisRateBook {
  private readonly ratesByCurrency = new Map<SupportedCurrency, number>();

  public constructor(
    private readonly rateSource: RateToNisSource = fxRateProvider
  ) {}

  public async convertToNis(amount: number, currency: string): Promise<number> {
    return amount * (await this.getRateToNis(currency));
  }

  public async getRateToNis(currency: string): Promise<number> {
    if (!isSupportedCurrency(currency)) {
      throw new Error(
        `Cannot convert to NIS from unsupported currency (currency: ${currency}, supported: ${SUPPORTED_CURRENCIES.join(
          ", "
        )})`
      );
    }

    if (currency === "NIS") {
      return NIS_TO_NIS_RATE;
    }

    const memoised = this.ratesByCurrency.get(currency);
    if (memoised !== undefined) {
      return memoised;
    }

    const rate = (await this.rateSource.getRateToNis(currency)).price;
    this.ratesByCurrency.set(currency, rate);
    return rate;
  }
}
