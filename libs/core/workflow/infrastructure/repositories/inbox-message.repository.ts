import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, EntityManager } from 'typeorm';

import { createLogger } from '@kodus/flow';

import { InboxMessageModel } from './schemas/inbox-message.model';

@Injectable()
export class InboxMessageRepository {
    private readonly logger = createLogger(InboxMessageRepository.name);

    constructor(
        @InjectRepository(InboxMessageModel)
        private readonly repository: Repository<InboxMessageModel>,
    ) {}

    async findByMessageId(
        messageId: string,
    ): Promise<InboxMessageModel | null> {
        try {
            return await this.repository.findOne({
                where: { messageId },
            });
        } catch (error) {
            this.logger.error({
                message: 'Failed to find inbox message by messageId',
                context: InboxMessageRepository.name,
                error,
                metadata: { messageId },
            });
            throw error;
        }
    }

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

    async create(
        messageId: string,
        jobId?: string,
        consumerId?: string,
    ): Promise<InboxMessageModel> {
        try {
            const model = this.repository.create({
                messageId,
                consumerId,
                job: jobId ? { uuid: jobId } : undefined,
                processed: false,
            });

            const saved = await this.repository.save(model);

            this.logger.debug({
                message: 'Inbox message created',
                context: InboxMessageRepository.name,
                metadata: { messageId, jobId, consumerId },
            });

            return saved;
        } catch (error) {
            this.logger.error({
                message: 'Failed to create inbox message',
                context: InboxMessageRepository.name,
                error,
                metadata: { messageId },
            });
            throw error;
        }
    }

    async markAsProcessed(
        messageId: string,
        consumerId?: string,
    ): Promise<void> {
        try {
            const where: any = { messageId };
            if (consumerId) {
                where.consumerId = consumerId;
            }

            await this.repository.update(where, {
                processed: true,
                processedAt: new Date(),
            });

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
                metadata: { messageId },
            });
            throw error;
        }
    }

    async deleteProcessedOlderThan(date: Date): Promise<number> {
        try {
            const result = await this.repository.delete({
                processed: true,
                processedAt: LessThan(date),
            });

            this.logger.log({
                message: `Deleted ${result.affected} processed inbox messages`,
                context: InboxMessageRepository.name,
                metadata: { olderThan: date },
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
        consumerId: string,
    ): Promise<boolean> {
        const existing = await manager.findOne(InboxMessageModel, {
            where: { messageId, consumerId },
        });
        return existing !== null;
    }

    /**
     * Mark message as processed within a transaction
     */
    async markAsProcessedInTransaction(
        manager: EntityManager,
        messageId: string,
        consumerId: string,
    ): Promise<void> {
        const existing = await manager.findOne(InboxMessageModel, {
            where: { messageId, consumerId },
        });

        if (existing) {
            await manager.update(
                InboxMessageModel,
                { uuid: existing.uuid },
                { processed: true, processedAt: new Date() },
            );
        } else {
            const model = manager.create(InboxMessageModel, {
                messageId,
                consumerId,
                processed: true,
                processedAt: new Date(),
            });
            await manager.save(InboxMessageModel, model);
        }
    }
}
