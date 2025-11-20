import type {
    ContextEvidence,
    EvidenceBus,
    EvidenceBusSubscription,
} from '../interfaces.js';

export interface EvidenceBusLogger {
    debug?(message: string, context?: Record<string, unknown>): void;
    warn?(message: string, context?: Record<string, unknown>): void;
    error?(message: string, context?: Record<string, unknown>): void;
}

type SubscriberRecord = {
    handler: (evidence: ContextEvidence) => Promise<void> | void;
    filter?: (evidence: ContextEvidence) => boolean;
};

/**
 * Simple in-memory EvidenceBus implementation. Suitable for unit tests,
 * local dev or small deployments. Production environments can swap this
 * out for Kafka, Redis Streams, etc. using o mesmo contrato.
 */
export class InMemoryEvidenceBus implements EvidenceBus {
    private readonly subscribers = new Map<number, SubscriberRecord>();
    private seq = 0;

    constructor(private readonly logger?: EvidenceBusLogger) {}

    async publish(
        evidence: ContextEvidence | ContextEvidence[],
    ): Promise<void> {
        const batch = Array.isArray(evidence) ? evidence : [evidence];
        if (!batch.length) {
            return;
        }

        for (const item of batch) {
            await this.dispatchItem(item);
        }
    }

    async subscribe(
        handler: (evidence: ContextEvidence) => Promise<void> | void,
        filter?: (evidence: ContextEvidence) => boolean,
    ): Promise<EvidenceBusSubscription> {
        const id = ++this.seq;
        this.subscribers.set(id, { handler, filter });

        return {
            unsubscribe: async () => {
                this.subscribers.delete(id);
            },
        };
    }

    private async dispatchItem(evidence: ContextEvidence): Promise<void> {
        for (const [id, subscriber] of this.subscribers) {
            try {
                if (subscriber.filter && !subscriber.filter(evidence)) {
                    continue;
                }
                await subscriber.handler(evidence);
            } catch (err) {
                this.logger?.warn?.('EvidenceBus handler failed', {
                    subscriberId: id,
                    error:
                        err instanceof Error
                            ? { message: err.message, stack: err.stack }
                            : err,
                });
            }
        }
    }
}
