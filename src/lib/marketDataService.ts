import { MarketData } from "@/types";
import { InvestmentType } from "@prisma/client";
import { getCachedData, setCachedData, generateMarketDataKey } from "./redis";
import * as cheerio from "cheerio";
import { cryptoPriceProvider } from "@/lib/providers/CryptoPriceProvider";

export async function getStockPrice(
  symbol: string
): Promise<MarketData | null> {
  const cacheKey = generateMarketDataKey(symbol, "stock");

  const cached = await getCachedData<MarketData>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const price = await getTickerPrice(symbol);
    const marketData: MarketData = {
      price,
      currency: "USD",
      lastUpdated: new Date(),
      source: "Google Finance",
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

export async function getCryptoPrice(
  symbol: string
): Promise<MarketData | null> {
  return cryptoPriceProvider.getPrice(symbol);
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
      return getCryptoPrice(symbol);
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function getTickerPrice(ticker: string): Promise<number> {
  const url = `https://www.google.com/finance/quote/${encodeURIComponent(
    ticker
  )}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load Google Finance page for ${ticker}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Google Finance main price element usually has classes 'YMlKec fxKbKc'
  const priceText = $(".YMlKec.fxKbKc").first().text().trim();
  if (!priceText) {
    throw new Error(`Price element not found for ${ticker}`);
  }

  const numeric = parseFloat(priceText.replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(numeric)) {
    throw new Error(`Could not parse price for ${ticker}`);
  }

  return numeric;
}

export async function getMultipleTickerPrices(
  tickers: string[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const ticker of tickers) {
    const price = await getTickerPrice(ticker);
    result[ticker] = price;
    await sleep(randomInt(1000, 2000));
  }
  return result;
}
