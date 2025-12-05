"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LONG_RUNNING_RETRY_POLICY = exports.CRITICAL_RETRY_POLICY = exports.DEFAULT_RETRY_POLICY = void 0;
const exponential_backoff_1 = require("../../../../../shared/utils/polling/exponential-backoff");
exports.DEFAULT_RETRY_POLICY = {
    maxAttempts: 3,
    backoff: exponential_backoff_1.BackoffPresets.STANDARD,
    retryableErrors: (error) => {
        const retryableErrorNames = [
            'NetworkError',
            'TimeoutError',
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ECONNREFUSED',
        ];
        const errorName = error.name || '';
        const errorMessage = error.message || '';
        return (retryableErrorNames.some((name) => errorName.includes(name) || errorMessage.includes(name)) ||
            errorMessage.toLowerCase().includes('network') ||
            errorMessage.toLowerCase().includes('timeout') ||
            errorMessage.toLowerCase().includes('connection'));
    },
};
exports.CRITICAL_RETRY_POLICY = {
    maxAttempts: 5,
    backoff: exponential_backoff_1.BackoffPresets.AGGRESSIVE,
    retryableErrors: exports.DEFAULT_RETRY_POLICY.retryableErrors,
};
exports.LONG_RUNNING_RETRY_POLICY = {
    maxAttempts: 2,
    backoff: exponential_backoff_1.BackoffPresets.CONSERVATIVE,
    retryableErrors: exports.DEFAULT_RETRY_POLICY.retryableErrors,
};
//# sourceMappingURL=retry-policy.config.js.map