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

    // Extract price from known Yahoo responses without falling back to 0
    let price: number | undefined;
    let currency = "USD";

    if (data.body && data.body.primaryData) {
      const priceString = data.body.primaryData.lastSalePrice as string | undefined;
      if (priceString) {
        const cleanPrice = priceString.replace(/[$,]/g, "");
        const parsed = parseFloat(cleanPrice);
        if (Number.isFinite(parsed) && parsed > 0) price = parsed;
      }
      currency = data.body.primaryData.currency || "USD";
    } else if (Array.isArray(data)) {
      const stockData = data.find((item: any) => item.symbol === symbol);
      if (stockData && typeof stockData.regularMarketPrice === "number") {
        const parsed = Number(stockData.regularMarketPrice);
        if (Number.isFinite(parsed) && parsed > 0) price = parsed;
      }
      currency = (stockData && stockData.currency) || "USD";
    }

    if (!Number.isFinite(price) || !price || price <= 0) {
      throw new Error(`Missing or invalid stock price for ${symbol}`);
    }

    const marketData: MarketData = {
      price,
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
    const raw = data?.[symbol]?.usd;
    const price = typeof raw === "number" ? Number(raw) : NaN;
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Missing or invalid crypto price for ${symbol}`);
    }

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
