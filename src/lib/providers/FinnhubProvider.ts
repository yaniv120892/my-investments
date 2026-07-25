import { PriceSource } from "@prisma/client";
import type { Currency, PriceProvider, Quote } from "@/lib/providers/types";

const FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote";
const FINNHUB_CURRENCY: Currency = "USD";

export class FinnhubProvider implements PriceProvider {
  public readonly source = PriceSource.FINNHUB;

  private readonly apiKey: string;

  public constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async fetchQuote(sourceSymbol: string): Promise<Quote> {
    if (!this.apiKey) {
      throw new Error(
        `FINNHUB_API_KEY is not configured, cannot price symbol ${sourceSymbol}`
      );
    }

    const url = `${FINNHUB_QUOTE_URL}?symbol=${encodeURIComponent(
      sourceSymbol
    )}&token=${this.apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Finnhub quote request failed (symbol: ${sourceSymbol}, status: ${response.status})`
      );
    }

    const data: { c?: number } = await response.json();
    const price = data?.c;

    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
      throw new Error(
        `Finnhub returned no usable price (symbol: ${sourceSymbol}, received: ${JSON.stringify(
          data
        )})`
      );
    }

    return {
      price,
      currency: FINNHUB_CURRENCY,
      fetchedAt: new Date(),
      source: "Finnhub",
    };
  }
}

export const finnhubProvider = new FinnhubProvider(
  process.env.FINNHUB_API_KEY ?? ""
);
