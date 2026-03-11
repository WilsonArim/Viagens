import type { RateLimiter, RateLimitResult } from "./types";

/**
 * Upstash Redis rate limiter using fixed-window counter via REST API.
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 */
export class RedisRateLimiter implements RateLimiter {
  private readonly url: string;
  private readonly token: string;

  constructor(url: string, token: string) {
    this.url = url.replace(/\/$/, "");
    this.token = token;
  }

  private async command<T>(args: string[]): Promise<T> {
    const res = await fetch(`${this.url}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });

    if (!res.ok) {
      throw new Error(`Upstash Redis error: ${res.status}`);
    }

    const data = (await res.json()) as { result: T };
    return data.result;
  }

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const redisKey = `rl:${key}`;
    const windowSec = Math.ceil(windowMs / 1000);

    const count = await this.command<number>(["INCR", redisKey]);

    if (count === 1) {
      await this.command<number>(["EXPIRE", redisKey, String(windowSec)]);
    }

    if (count > limit) {
      const ttl = await this.command<number>(["TTL", redisKey]);
      return { allowed: false, retryAfter: Math.max(ttl, 1) };
    }

    return { allowed: true, retryAfter: 0 };
  }
}
