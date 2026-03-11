import type { RateLimiter, RateLimitResult } from "./types";
import { MemoryRateLimiter } from "./memory";
import { RedisRateLimiter } from "./redis";

export type { RateLimitResult } from "./types";

function createLimiter(): RateLimiter {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    return new RedisRateLimiter(url, token);
  }

  return new MemoryRateLimiter();
}

const limiter = createLimiter();

export async function checkRateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
): Promise<RateLimitResult> {
  return limiter.check(key, limit, windowMs);
}
