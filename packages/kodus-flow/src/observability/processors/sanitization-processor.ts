import { SpanProcessor, TraceItem } from '../types.js';

/**
 * Processor to redact sensitive information from traces before export
 */
export class SanitizationProcessor implements SpanProcessor {
    private sensitiveKeys: Set<string>;
    private redactedValue = '[REDACTED]';

    constructor(
        config: { sensitiveKeys?: string[]; redactedValue?: string } = {},
    ) {
        // Default sensitive keys
        this.sensitiveKeys = new Set([
            'password',
            'token',
            'apikey',
            'api_key',
            'secret',
            'authorization',
            'bearer',
            'creditcard',
            'cvv',
            'ssn',
            'cpf',
            ...(config.sensitiveKeys || []).map((k) => k.toLowerCase()),
        ]);

        if (config.redactedValue) {
            this.redactedValue = config.redactedValue;
        }
    }

    async process(item: TraceItem): Promise<void> {
        this.sanitizeAttributes(item.attributes);
    }

    private sanitizeAttributes(
        attributes: Record<string, string | number | boolean>,
    ): void {
        for (const key in attributes) {
            if (this.isSensitive(key)) {
                attributes[key] = this.redactedValue;
            }
        }
    }

    private isSensitive(key: string): boolean {
        const lowerKey = key.toLowerCase();
        // Check exact match or partial match for common patterns
        for (const sensitive of this.sensitiveKeys) {
            if (lowerKey.includes(sensitive)) {
                return true;
            }
        }
        return false;
    }

    async flush(): Promise<void> {
        // No-op
    }

    async shutdown(): Promise<void> {
        // No-op
    }
}
