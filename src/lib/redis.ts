import { Redis } from '@upstash/redis'

if (!process.env.UPSTASH_REDIS_REST_URL) {
  throw new Error('UPSTASH_REDIS_REST_URL is not defined');
}

if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('UPSTASH_REDIS_REST_TOKEN is not defined');
}

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Cache TTL in seconds (24 hours)
const CACHE_TTL = 24 * 60 * 60;

let redisCommandCount = 0;

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    redisCommandCount++;
    console.log(`[Redis GET] Key: ${key}, Total commands: ${redisCommandCount}`);
    const cachedData = await redis.get(key);
    if (cachedData) {
      return cachedData as T;
    }
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

export async function setCachedData(key: string, data: any, ttl: number = CACHE_TTL): Promise<void> {
  try {
    redisCommandCount++;
    console.log(`[Redis SET] Key: ${key}, Total commands: ${redisCommandCount}`);
    await redis.set(key, data, { ex: ttl });
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

export async function invalidateCache(key: string): Promise<void> {
  try {
    redisCommandCount++;
    console.log(`[Redis DEL] Key: ${key}, Total commands: ${redisCommandCount}`);
    await redis.del(key);
  } catch (error) {
    console.error('Redis delete error:', error);
  }
}

// Helper to generate consistent cache keys
export function generateCacheKey(...parts: (string | number)[]): string {
  return parts.join(':');
}

// Reset command counter
export function resetRedisCommandCount() {
  redisCommandCount = 0;
}

export default redis; 