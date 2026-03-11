export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}
