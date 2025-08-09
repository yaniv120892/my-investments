import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CACHE_TTL = 3600; // 1 hour in seconds

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (data === null) return null;
    return data as T;
  } catch (error) {
    console.error("Redis get error:", error);
    return null;
  }
}

export async function setCachedData<T>(key: string, data: T): Promise<void> {
  try {
    await redis.setex(key, CACHE_TTL, data);
  } catch (error) {
    console.error("Redis set error:", error);
  }
}

export async function deleteCachedData(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    console.error("Redis delete error:", error);
  }
}

export function generateMarketDataKey(symbol: string, type: string): string {
  return `market_data:${type}:${symbol.toLowerCase()}`;
}

export function generatePortfolioKey(userId: string): string {
  return `portfolio:${userId}`;
}
