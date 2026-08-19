import type { PriceSource } from "@prisma/client";
import type { SupportedCurrency } from "@/lib/pricing/supportedCurrencies";

export interface Quote {
  price: number;
  currency: SupportedCurrency;
  fetchedAt: Date;
  source: string;
}

export interface PriceProvider {
  readonly source: PriceSource;
  fetchQuote(sourceSymbol: string): Promise<Quote>;
}
