import type { PriceSource } from "@prisma/client";

export type Currency = "USD" | "NIS";

export interface Quote {
  price: number;
  currency: Currency;
  fetchedAt: Date;
  source: string;
}

export interface PriceProvider {
  readonly source: PriceSource;
  fetchQuote(sourceSymbol: string): Promise<Quote>;
}
