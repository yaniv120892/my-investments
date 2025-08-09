import { MarketData } from "@/types";
import { InvestmentType } from "@prisma/client";
import { getCachedData, setCachedData, generateMarketDataKey } from "./redis";
import { cryptoPriceProvider } from "@/lib/providers/CryptoPriceProvider";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

export async function getStockPrice(
  symbol: string
): Promise<MarketData | null> {
  const cacheKey = generateMarketDataKey(symbol, "stock");

  const cached = await getCachedData<MarketData>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
      symbol
    )}&token=${FINNHUB_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: { c?: number } = await response.json();
    const price = typeof data?.c === "number" ? Number(data.c) : NaN;
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Missing or invalid stock price for ${symbol}`);
    }

    const marketData: MarketData = {
      price,
      currency: "USD",
      lastUpdated: new Date(),
      source: "Finnhub",
    };

    await setCachedData(cacheKey, marketData);
    return marketData;
  } catch (error) {
    console.warn(
      `Warning: Unable to fetch stock price for symbol ${symbol}:`,
      error
    );
    return null;
  }
}

export async function getUSDToNISRate(): Promise<MarketData | null> {
  const cacheKey = generateMarketDataKey("usd", "currency");

  const cached = await getCachedData<MarketData>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(
      "https://api.boi.gov.il/currency/rate?currency=USD",
      {
        headers: {
          Authorization: `Bearer ${process.env.BOI_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const rate = typeof data?.rate === "number" ? Number(data.rate) : NaN;
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Missing or invalid USD/NIS exchange rate");
    }

    const marketData: MarketData = {
      price: rate,
      currency: "NIS",
      lastUpdated: new Date(),
      source: "Bank of Israel",
    };

    await setCachedData(cacheKey, marketData);
    return marketData;
  } catch (error) {
    console.warn(`Warning: Unable to fetch USD/NIS exchange rate:`, error);
    return null;
  }
}

export async function getMarketData(
  symbol: string,
  type: InvestmentType
): Promise<MarketData | null> {
  switch (type) {
    case InvestmentType.STOCK:
      return getStockPrice(symbol);
    case InvestmentType.CRYPTO:
      return cryptoPriceProvider.getPrice(symbol);
    case InvestmentType.FOREIGN_CURRENCY:
      if (symbol.toLowerCase() === "usd") {
        return getUSDToNISRate();
      }
      return null;
    default:
      return null;
  }
}

export function convertToNIS(
  price: number,
  fromCurrency: string,
  usdToNISRate: number
): number {
  if (fromCurrency === "NIS") {
    return price;
  }
  if (fromCurrency === "USD") {
    return price * usdToNISRate;
  }
  return price;
}
