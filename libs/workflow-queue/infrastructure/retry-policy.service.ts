import { Injectable } from '@nestjs/common';
import { createLogger } from '@kodus/flow';
import {
    calculateBackoffInterval,
    BackoffOptions,
    BackoffPresets,
} from '@shared/utils/polling/exponential-backoff';

export interface RetryPolicy {
    maxAttempts: number;
    backoff: BackoffOptions;
    retryableErrors?: (error: Error) => boolean;
    onRetry?: (attempt: number, error: Error, delay: number) => void;
}

@Injectable()
export class RetryPolicyService {
    private readonly logger = createLogger(RetryPolicyService.name);

    /**
     * Execute function with retry policy
     */
    async executeWithRetry<T>(
        fn: () => Promise<T>,
        policy: RetryPolicy,
    ): Promise<T> {
        let attempt = 0;
        let lastError: Error | undefined;

        while (attempt < policy.maxAttempts) {
            try {
                return await fn();
            } catch (error) {
                lastError =
                    error instanceof Error ? error : new Error(String(error));
                attempt++;

                // Check if error is retryable
                if (
                    policy.retryableErrors &&
                    !policy.retryableErrors(lastError)
                ) {
                    throw lastError; // Don't retry non-retryable errors
                }

                // Check if max attempts reached
                if (attempt >= policy.maxAttempts) {
                    this.logger.error({
                        message: `Max retry attempts (${policy.maxAttempts}) reached`,
                        context: RetryPolicyService.name,
                        error: lastError,
                        metadata: { attempt, maxAttempts: policy.maxAttempts },
                    });
                    throw lastError;
                }

                // Calculate backoff delay
                const delay = calculateBackoffInterval(
                    attempt - 1,
                    policy.backoff,
                );

                // Callback before retry
                if (policy.onRetry) {
                    policy.onRetry(attempt, lastError, delay);
                }

                this.logger.warn({
                    message: `Retrying operation (attempt ${attempt}/${policy.maxAttempts})`,
                    context: RetryPolicyService.name,
                    error: lastError,
                    metadata: {
                        attempt,
                        maxAttempts: policy.maxAttempts,
                        delayMs: delay,
                    },
                });

                // Wait before retry
                await this.sleep(delay);
            }
        }

        // Should never reach here, but TypeScript needs it
        throw lastError || new Error('Retry failed');
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
