/**
 * Intentionally kept broad to avoid leaking infrastructure-only enums into the domain contracts.
 * Concrete implementations typically use a string enum persisted in the DB.
 */
export type InboxStatus = unknown;

export interface IInboxMessageRepository {
    claim(
        messageId: string,
        consumerId: string,
        lockedBy: string,
        jobId?: string,
    ): Promise<unknown | null>;
    findByConsumerAndMessageId(
        consumerId: string,
        messageId: string,
    ): Promise<{ status: InboxStatus } | null>;
    markAsProcessed(messageId: string, consumerId: string): Promise<void>;
    releaseLock(
        messageId: string,
        consumerId: string,
        lastError?: string,
    ): Promise<void>;
    reclaimStaleMessages(olderThan: Date): Promise<number>;
    deleteProcessedOlderThan(date: Date): Promise<number>;
}

export const INBOX_MESSAGE_REPOSITORY_TOKEN = Symbol.for(
    'InboxMessageRepository',
);
