import { Injectable } from '@nestjs/common';
import { createLogger } from '@kodus/flow';
import { CacheService } from '@libs/core/cache/cache.service';

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt?: Date;
}

/**
 * Service for rate limiting trial CLI reviews
 * Uses cache to track request counts per fingerprint
 */
@Injectable()
export class TrialRateLimiterService {
    private readonly logger = createLogger(TrialRateLimiterService.name);
    private readonly RATE_LIMIT = 10; // 10 requests per window
    private readonly WINDOW_MS = 60 * 60 * 1000; // 1 hour

    constructor(private readonly cacheService: CacheService) {}

    async checkRateLimit(fingerprint: string): Promise<RateLimitResult> {
        const key = `cli:trial:ratelimit:${fingerprint}`;
        const now = Date.now();
        const windowStart = now - this.WINDOW_MS;

        try {
            // Get current request timestamps
            const timestampsData = await this.cacheService.getFromCache<{
                timestamps: number[];
            }>(key);

            let timestamps = timestampsData?.timestamps || [];

            // Filter out old timestamps outside the window
            timestamps = timestamps.filter((ts) => ts > windowStart);

            // Add current request
            timestamps.push(now);

            // Store updated timestamps
            await this.cacheService.addToCache(
                key,
                { timestamps },
                this.WINDOW_MS,
            );

            const count = timestamps.length;
            const allowed = count <= this.RATE_LIMIT;
            const remaining = Math.max(0, this.RATE_LIMIT - count);

            // Calculate reset time (oldest timestamp + window duration)
            const oldestTimestamp = timestamps[0];
            const resetAt = oldestTimestamp
                ? new Date(oldestTimestamp + this.WINDOW_MS)
                : new Date(now + this.WINDOW_MS);

            if (!allowed) {
                this.logger.warn({
                    message: 'Rate limit exceeded for trial user',
                    context: TrialRateLimiterService.name,
                    metadata: {
                        fingerprint,
                        count,
                        limit: this.RATE_LIMIT,
                        resetAt: resetAt.toISOString(),
                    },
                });
            }

            return {
                allowed,
                remaining,
                resetAt,
            };
        } catch (error) {
            this.logger.error({
                message: 'Error checking rate limit, failing open',
                error,
                context: TrialRateLimiterService.name,
                metadata: { fingerprint },
            });

            // Fail open - allow the request if cache fails
            return {
                allowed: true,
                remaining: this.RATE_LIMIT,
            };
        }
    }

    /**
     * Get current rate limit status without incrementing
     */
    async getRateLimitStatus(fingerprint: string): Promise<RateLimitResult> {
        const key = `cli:trial:ratelimit:${fingerprint}`;
        const now = Date.now();
        const windowStart = now - this.WINDOW_MS;

        try {
            const timestampsData = await this.cacheService.getFromCache<{
                timestamps: number[];
            }>(key);

            let timestamps = timestampsData?.timestamps || [];
            timestamps = timestamps.filter((ts) => ts > windowStart);

            const count = timestamps.length;
            const allowed = count < this.RATE_LIMIT;
            const remaining = Math.max(0, this.RATE_LIMIT - count);

            const oldestTimestamp = timestamps[0];
            const resetAt = oldestTimestamp
                ? new Date(oldestTimestamp + this.WINDOW_MS)
                : undefined;

            return {
                allowed,
                remaining,
                resetAt,
            };
        } catch (error) {
            this.logger.error({
                message: 'Error getting rate limit status',
                error,
                context: TrialRateLimiterService.name,
            });

            return {
                allowed: true,
                remaining: this.RATE_LIMIT,
            };
        }
    }
}
