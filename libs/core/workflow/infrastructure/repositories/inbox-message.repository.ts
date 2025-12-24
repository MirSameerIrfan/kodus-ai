import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, EntityManager } from 'typeorm';

import { createLogger } from '@kodus/flow';

import { InboxMessageModel, InboxStatus } from './schemas/inbox-message.model';
import { IInboxMessageRepository } from '../../domain/contracts/inbox-message.repository.contract';

@Injectable()
export class InboxMessageRepository implements IInboxMessageRepository {
    private readonly logger = createLogger(InboxMessageRepository.name);

    constructor(
        @InjectRepository(InboxMessageModel)
        private readonly repository: Repository<InboxMessageModel>,
    ) {}

    async findByConsumerAndMessageId(
        consumerId: string,
        messageId: string,
    ): Promise<InboxMessageModel | null> {
        try {
            return await this.repository.findOne({
                where: { consumerId, messageId },
            });
        } catch (error) {
            this.logger.error({
                message: 'Failed to find inbox message',
                context: InboxMessageRepository.name,
                error,
                metadata: { consumerId, messageId },
            });
            throw error;
        }
    }

    /**
     * Claims a message for processing using an atomic UPSERT.
     * Returns the message model if successfully claimed, or null if it's already being processed or finished.
     */
    async claim(
        messageId: string,
        consumerId: string,
        lockedBy: string,
        jobId?: string,
    ): Promise<InboxMessageModel | null> {
        const query = `
            INSERT INTO "kodus_workflow"."inbox_messages"
                ("messageId", "consumerId", "job_id", "status", "lockedBy", "lockedAt", "attempts", "createdAt", "updatedAt")
            VALUES
                ($1, $2, $3, $4, $5, NOW(), 1, NOW(), NOW())
            ON CONFLICT ("consumerId", "messageId")
            DO UPDATE SET
                "status" = $4,
                "lockedBy" = $5,
                "lockedAt" = NOW(),
                "attempts" = "inbox_messages"."attempts" + 1,
                "updatedAt" = NOW()
            WHERE "inbox_messages"."status" NOT IN ($6, $7)
               OR ("inbox_messages"."status" = $7 AND "inbox_messages"."lockedAt" < NOW() - INTERVAL '5 minutes')
            RETURNING *;
        `;

        try {
            const results = await this.repository.query(query, [
                messageId,
                consumerId,
                jobId || null,
                InboxStatus.PROCESSING,
                lockedBy,
                InboxStatus.PROCESSED,
                InboxStatus.PROCESSING,
            ]);

            if (results && results.length > 0) {
                return this.repository.create(results[0] as InboxMessageModel);
            }

            return null;
        } catch (error) {
            this.logger.error({
                message: 'Failed to claim inbox message',
                context: InboxMessageRepository.name,
                error,
                metadata: { messageId, consumerId },
            });
            throw error;
        }
    }

    async markAsProcessed(
        messageId: string,
        consumerId: string,
    ): Promise<void> {
        try {
            await this.repository.update(
                { messageId, consumerId },
                {
                    status: InboxStatus.PROCESSED,
                    processedAt: new Date(),
                    lockedBy: null,
                    lockedAt: null,
                },
            );

            this.logger.debug({
                message: 'Inbox message marked as processed',
                context: InboxMessageRepository.name,
                metadata: { messageId, consumerId },
            });
        } catch (error) {
            this.logger.error({
                message: 'Failed to mark inbox message as processed',
                context: InboxMessageRepository.name,
                error,
                metadata: { messageId, consumerId },
            });
            throw error;
        }
    }

    /**
     * Releases the lock on a message after a failed processing attempt.
     * Sets status back to READY so it can be re-claimed on retry.
     * Retry scheduling is handled by RabbitMQ (single source of truth for backoff).
     */
    async releaseLock(
        messageId: string,
        consumerId: string,
        error?: string,
    ): Promise<void> {
        try {
            await this.repository.update(
                { messageId, consumerId },
                {
                    status: InboxStatus.READY,
                    lastError: error?.substring(0, 2000),
                    lockedBy: null,
                    lockedAt: null,
                },
            );
        } catch (err) {
            this.logger.error({
                message: 'Failed to release inbox lock',
                context: InboxMessageRepository.name,
                error: err,
                metadata: { messageId },
            });
            throw err;
        }
    }

    /**
     * Reclaims messages stuck in PROCESSING status for too long.
     * These messages will be re-processed when RabbitMQ redelivers them.
     */
    async reclaimStaleMessages(olderThan: Date): Promise<number> {
        try {
            const result = await this.repository.update(
                {
                    status: InboxStatus.PROCESSING,
                    lockedAt: LessThan(olderThan),
                },
                {
                    status: InboxStatus.READY,
                    lockedBy: null,
                    lockedAt: null,
                    lastError: 'Stuck in PROCESSING - Reclaimed by reaper',
                },
            );
            return result.affected || 0;
        } catch (error) {
            this.logger.error({
                message: 'Failed to reclaim stale inbox messages',
                context: InboxMessageRepository.name,
                error,
            });
            throw error;
        }
    }

    async deleteProcessedOlderThan(date: Date): Promise<number> {
        try {
            const result = await this.repository.delete({
                status: InboxStatus.PROCESSED,
                processedAt: LessThan(date),
            });
            return result.affected || 0;
        } catch (error) {
            this.logger.error({
                message: 'Failed to delete old inbox messages',
                context: InboxMessageRepository.name,
                error,
            });
            throw error;
        }
    }

    /**
     * Check if message was already processed within a transaction
     */
    async isProcessedInTransaction(
        manager: EntityManager,
        messageId: string,
        consumerId: string = 'default',
    ): Promise<boolean> {
        const query = `
            SELECT status FROM "kodus_workflow"."inbox_messages"
            WHERE "messageId" = $1 AND "consumerId" = $2
        `;
        const results = await manager.query(query, [messageId, consumerId]);
        return (
            results.length > 0 && results[0].status === InboxStatus.PROCESSED
        );
    }

    /**
     * Atomic mark as processed within a transaction.
     */
    async markAsProcessedInTransaction(
        manager: EntityManager,
        messageId: string,
        consumerId: string,
        jobId?: string,
    ): Promise<void> {
        const query = `
            INSERT INTO "kodus_workflow"."inbox_messages"
                ("messageId", "consumerId", "job_id", "status", "processedAt", "createdAt", "updatedAt")
            VALUES
                ($1, $2, $3, $4, NOW(), NOW(), NOW())
            ON CONFLICT ("consumerId", "messageId")
            DO UPDATE SET
                "status" = $4,
                "processedAt" = NOW(),
                "updatedAt" = NOW();
        `;

        await manager.query(query, [
            messageId,
            consumerId,
            jobId || null,
            InboxStatus.PROCESSED,
        ]);
    }
}
