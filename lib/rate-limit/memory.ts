import type { RateLimiter, RateLimitResult } from "./types";

interface Bucket {
  count: number;
  resetAt: number;
}

declare global {
  var rateLimitStore: Map<string, Bucket> | undefined;
}

const store = global.rateLimitStore ?? new Map<string, Bucket>();

if (!global.rateLimitStore) {
  global.rateLimitStore = store;
}

function cleanupExpired() {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
}

export class MemoryRateLimiter implements RateLimiter {
  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();

    if (store.size > 500) {
      cleanupExpired();
    }

    const current = store.get(key);

    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfter: 0 };
    }

    if (current.count >= limit) {
      return {
        allowed: false,
        retryAfter: Math.ceil((current.resetAt - now) / 1000),
      };
    }

    current.count += 1;
    store.set(key, current);
    return { allowed: true, retryAfter: 0 };
  }
}
