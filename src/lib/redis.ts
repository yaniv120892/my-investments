import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? "";
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

// Unconfigured Upstash is survivable — the cache is not a store — but it must
// say so once at boot rather than as an error line per key, forever.
if (!redisUrl || !redisToken) {
  console.warn(
    `Upstash is not configured; every price will be fetched live (UPSTASH_REDIS_REST_URL set: ${Boolean(
      redisUrl
    )}, UPSTASH_REDIS_REST_TOKEN set: ${Boolean(redisToken)})`
  );
}

const redis = new Redis({ url: redisUrl, token: redisToken });

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
