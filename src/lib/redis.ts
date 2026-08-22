import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CACHE_TTL_SECONDS = 3600;

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (data === null) {
      return null;
    }
    return data as T;
  } catch (error) {
    console.error(`Redis get failed (key: ${key}):`, error);
    return null;
  }
}

export async function setCachedData<T>(key: string, data: T): Promise<void> {
  try {
    await redis.setex(key, CACHE_TTL_SECONDS, data);
  } catch (error) {
    console.error(
      `Redis set failed (key: ${key}, ttlSeconds: ${CACHE_TTL_SECONDS}):`,
      error
    );
  }
}

export async function deleteCachedData(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    console.error(`Redis delete failed (key: ${key}):`, error);
  }
}

export function generateMarketDataKey(symbol: string, type: string): string {
  return `market_data:${type}:${symbol.toLowerCase()}`;
}

export function generatePortfolioKey(userId: string): string {
  return `portfolio:${userId}`;
}
