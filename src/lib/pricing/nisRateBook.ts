import { fxRateProvider } from "@/lib/providers/FxRateProvider";
import {
  SUPPORTED_CURRENCIES,
  isSupportedCurrency,
} from "@/lib/pricing/supportedCurrencies";
import type { SupportedCurrency } from "@/lib/pricing/supportedCurrencies";
import type { RateToNisSource } from "@/lib/pricing/nisRateBook.types";

export type { RateToNisSource } from "@/lib/pricing/nisRateBook.types";

/** NIS needs no conversion to itself; snapshots still record the rate they used. */
export const NIS_TO_NIS_RATE = 1;

/**
 * Memoises each currency's rate for the life of one pricing run, so a portfolio
 * holding twenty USD positions still costs one FX request.
 */
export class NisRateBook {
  // Keyed on the in-flight request, not the resolved rate, so that concurrent
  // callers share one lookup instead of racing to miss an empty entry.
  private readonly ratesByCurrency = new Map<
    SupportedCurrency,
    Promise<number>
  >();

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

    const pending = this.loadRateToNis(currency);
    this.ratesByCurrency.set(currency, pending);

    try {
      return await pending;
    } catch (error) {
      // Evicted so one blip does not condemn every later holding in the run.
      this.ratesByCurrency.delete(currency);
      throw error;
    }
  }

  private async loadRateToNis(currency: SupportedCurrency): Promise<number> {
    return (await this.rateSource.getRateToNis(currency)).price;
  }
}
