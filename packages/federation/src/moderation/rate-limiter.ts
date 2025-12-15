/**
 * Rate Limiter
 *
 * Token bucket rate limiting for moderation actions.
 * Prevents abuse of report/flag functionality.
 */

import type { ModerationStore, RateLimitBucket, RateLimitResult } from './types.js';

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Max tokens per bucket (default: 5) */
  maxTokens: number;
  /** Tokens per hour refill rate (default: 1) */
  refillRate: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxTokens: 5,
  refillRate: 1,
};

/**
 * Token bucket rate limiter
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter(moderationStore, {
 *   maxTokens: 10,
 *   refillRate: 2, // 2 tokens per hour
 * });
 *
 * const result = await limiter.checkAndConsume('https://example.com/users/alice');
 * if (!result.allowed) {
 *   return new Response('Too many reports', {
 *     status: 429,
 *     headers: { 'Retry-After': String(result.retryAfter) },
 *   });
 * }
 * ```
 */
export class RateLimiter {
  private store: ModerationStore;
  private config: RateLimiterConfig;

  constructor(store: ModerationStore, config?: Partial<RateLimiterConfig>) {
    this.store = store;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if action is allowed and consume a token if so
   *
   * @param actorId - Actor URI to check
   * @returns Rate limit result with remaining tokens and reset time
   */
  async checkAndConsume(actorId: string): Promise<RateLimitResult> {
    let bucket = await this.store.getRateLimitBucket(actorId);

    if (!bucket) {
      // Create new bucket for actor
      bucket = {
        actorId,
        tokens: this.config.maxTokens,
        maxTokens: this.config.maxTokens,
        lastRefill: new Date().toISOString(),
        refillRate: this.config.refillRate,
      };
    }

    // Refill tokens based on time elapsed
    bucket = this.refillBucket(bucket);

    if (bucket.tokens < 1) {
      const resetAt = this.calculateResetTime(bucket);
      const retryAfter = Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000);

      // Update bucket even if denied (to persist refill time)
      await this.store.updateRateLimitBucket(bucket);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.max(0, retryAfter),
      };
    }

    // Consume token
    bucket.tokens -= 1;
    await this.store.updateRateLimitBucket(bucket);

    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      resetAt: this.calculateResetTime(bucket),
    };
  }

  /**
   * Check remaining tokens without consuming
   *
   * @param actorId - Actor URI to check
   * @returns Current rate limit status
   */
  async check(actorId: string): Promise<RateLimitResult> {
    let bucket = await this.store.getRateLimitBucket(actorId);

    if (!bucket) {
      return {
        allowed: true,
        remaining: this.config.maxTokens,
        resetAt: new Date().toISOString(),
      };
    }

    bucket = this.refillBucket(bucket);

    return {
      allowed: bucket.tokens >= 1,
      remaining: Math.floor(bucket.tokens),
      resetAt: this.calculateResetTime(bucket),
      retryAfter:
        bucket.tokens < 1
          ? Math.ceil((new Date(this.calculateResetTime(bucket)).getTime() - Date.now()) / 1000)
          : undefined,
    };
  }

  /**
   * Reset rate limit for an actor (admin function)
   *
   * @param actorId - Actor URI to reset
   */
  async reset(actorId: string): Promise<void> {
    const bucket: RateLimitBucket = {
      actorId,
      tokens: this.config.maxTokens,
      maxTokens: this.config.maxTokens,
      lastRefill: new Date().toISOString(),
      refillRate: this.config.refillRate,
    };
    await this.store.updateRateLimitBucket(bucket);
  }

  /**
   * Refill tokens based on time elapsed since last refill
   */
  private refillBucket(bucket: RateLimitBucket): RateLimitBucket {
    const now = new Date();
    const lastRefill = new Date(bucket.lastRefill);
    const hoursSinceRefill = (now.getTime() - lastRefill.getTime()) / (1000 * 60 * 60);

    const tokensToAdd = hoursSinceRefill * bucket.refillRate;

    if (tokensToAdd >= 1) {
      // Only update if we're adding at least 1 token (avoid floating point issues)
      bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + Math.floor(tokensToAdd));
      bucket.lastRefill = now.toISOString();
    }

    return bucket;
  }

  /**
   * Calculate when bucket will have at least 1 token
   */
  private calculateResetTime(bucket: RateLimitBucket): string {
    if (bucket.tokens >= bucket.maxTokens) {
      return new Date().toISOString();
    }

    // Calculate time until 1 token is available
    const tokensNeeded = Math.max(0, 1 - bucket.tokens);
    const hoursUntilToken = tokensNeeded / bucket.refillRate;
    const msUntilToken = hoursUntilToken * 60 * 60 * 1000;

    const lastRefill = new Date(bucket.lastRefill);
    return new Date(lastRefill.getTime() + msUntilToken).toISOString();
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimiterConfig {
    return { ...this.config };
  }
}
