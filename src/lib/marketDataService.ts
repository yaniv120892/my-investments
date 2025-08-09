import { MarketData } from "@/types";
import { InvestmentType } from "@prisma/client";
import { getCachedData, setCachedData, generateMarketDataKey } from "./redis";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

export async function getStockPrice(
  symbol: string
): Promise<MarketData | null> {
  const cacheKey = generateMarketDataKey(symbol, "stock");

  const cached = await getCachedData<MarketData>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(
      `https://yahoo-finance15.p.rapidapi.com/api/v1/markets/quote?ticker=${symbol}&type=STOCKS`,
      {
        headers: {
          "X-RapidAPI-Key": RAPIDAPI_KEY!,
          "X-RapidAPI-Host": "yahoo-finance15.p.rapidapi.com",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Handle the actual API response format
    let price: number | string = 0;
    let currency = "USD";

    if (data.body && data.body.primaryData) {
      // Extract price from the lastSalePrice string (remove $ and convert to number)
      const priceString = data.body.primaryData.lastSalePrice;
      if (priceString) {
        const cleanPrice = priceString.replace(/[$,]/g, "");
        price = parseFloat(cleanPrice) || 0;
      }
      currency = data.body.primaryData.currency || "USD";
    } else if (Array.isArray(data)) {
      // Fallback to the original Yahoo Finance format
      const stockData = data.find((item) => item.symbol === symbol);
      if (stockData) {
        price = stockData.regularMarketPrice || 0;
        currency = stockData.currency || "USD";
      }
    }

    // Ensure price is a valid number
    if (typeof price === "string") {
      price = parseFloat(price.replace(/[$,]/g, "")) || 0;
    }

    const marketData: MarketData = {
      price: typeof price === "number" ? price : 0,
      currency,
      lastUpdated: new Date(),
      source: "Yahoo Finance",
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
  const cacheKey = generateMarketDataKey(symbol, "crypto");

  const cached = await getCachedData<MarketData>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`,
      {
        headers: {
          "X-CG-API-KEY": COINGECKO_API_KEY || "",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const price = data[symbol]?.usd || 0;

    const marketData: MarketData = {
      price,
      currency: "USD",
      lastUpdated: new Date(),
      source: "CoinGecko",
    };

    await setCachedData(cacheKey, marketData);
    return marketData;
  } catch (error) {
    console.warn(
      `Warning: Unable to fetch crypto price for symbol ${symbol}:`,
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
      const fallbackRate = 3.65;
      const marketData: MarketData = {
        price: fallbackRate,
        currency: "NIS",
        lastUpdated: new Date(),
        source: "Bank of Israel (fallback)",
      };
      await setCachedData(cacheKey, marketData);
      return marketData;
    }

    const data = await response.json();
    const rate = data.rate || 3.65;

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
