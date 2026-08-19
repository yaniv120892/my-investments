import type { MarketData } from "@/types";
import type { SupportedCurrency } from "@/lib/pricing/supportedCurrencies";

/** The slice of FxRateProvider the rate book actually depends on. */
export interface RateToNisSource {
  getRateToNis(currency: SupportedCurrency): Promise<MarketData>;
}
