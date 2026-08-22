import type { MarketData } from "@/types";
import type { SupportedCurrency } from "@/lib/pricing/supportedCurrencies";

export interface RateToNisSource {
  getRateToNis(currency: SupportedCurrency): Promise<MarketData>;
}
