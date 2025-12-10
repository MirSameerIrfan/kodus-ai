import { BackoffPresets } from '@libs/core/utils/polling/exponential-backoff';

import { RetryPolicy } from './retry-policy.service';

/**
 * Default retry policy for workflow queue operations
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
    maxAttempts: 3,
    backoff: BackoffPresets.STANDARD, // 1s, 2s, 4s, 8s, 16s, 30s (cap)
    retryableErrors: (error: Error) => {
        // Retry apenas em erros temporários
        const retryableErrorNames = [
            'NetworkError',
            'TimeoutError',
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ECONNREFUSED',
        ];

        // Verificar se o nome do erro contém algum dos nomes retryable
        const errorName = error.name || '';
        const errorMessage = error.message || '';

        return (
            retryableErrorNames.some(
                (name) =>
                    errorName.includes(name) || errorMessage.includes(name),
            ) ||
            // Retry em erros de rede genéricos
            errorMessage.toLowerCase().includes('network') ||
            errorMessage.toLowerCase().includes('timeout') ||
            errorMessage.toLowerCase().includes('connection')
        );
    },
};

/**
 * Retry policy for critical operations (more attempts, faster backoff)
 */
export const CRITICAL_RETRY_POLICY: RetryPolicy = {
    maxAttempts: 5,
    backoff: BackoffPresets.AGGRESSIVE, // 500ms, 1s, 2s, 4s, 8s, 15s (cap)
    retryableErrors: DEFAULT_RETRY_POLICY.retryableErrors,
};

/**
 * Retry policy for long-running operations (fewer attempts, slower backoff)
 */
export const LONG_RUNNING_RETRY_POLICY: RetryPolicy = {
    maxAttempts: 2,
    backoff: BackoffPresets.CONSERVATIVE, // 2s, 6s, 18s, 54s, 60s (cap)
    retryableErrors: DEFAULT_RETRY_POLICY.retryableErrors,
};
