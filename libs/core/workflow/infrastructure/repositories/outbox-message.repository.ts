import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, EntityManager } from 'typeorm';

import { createLogger } from '@kodus/flow';
import { OutboxMessage } from '../../domain/interfaces/outbox-message.interface';

import { OutboxMessageModel } from './schemas/outbox-message.model';

@Injectable()
export class OutboxMessageRepository {
    private readonly logger = createLogger(OutboxMessageRepository.name);

    constructor(
        @InjectRepository(OutboxMessageModel)
        private readonly repository: Repository<OutboxMessageModel>,
    ) {}

    async create(
        message: OutboxMessage,
        transactionManager?: EntityManager,
    ): Promise<OutboxMessageModel> {
        try {
            const repo = transactionManager
                ? transactionManager.getRepository(OutboxMessageModel)
                : this.repository;

            const model = repo.create({
                job: message.jobId ? { uuid: message.jobId } : undefined,
                exchange: message.exchange,
                routingKey: message.routingKey,
                payload: message.payload,
                processed: false,
            });

            const saved = await repo.save(model);

            this.logger.debug({
                message: 'Outbox message created',
                context: OutboxMessageRepository.name,
                metadata: {
                    messageId: saved.uuid,
                    exchange: saved.exchange,
                    routingKey: saved.routingKey,
                },
            });

            return saved;
        } catch (error) {
            this.logger.error({
                message: 'Failed to create outbox message',
                context: OutboxMessageRepository.name,
                error,
            });
            throw error;
        }
    }

    /**
     * Finds unprocessed messages using SKIP LOCKED to allow concurrent processing by multiple workers.
     * This prevents multiple workers from picking up the same message.
     */
    async findUnprocessed(limit: number = 100): Promise<OutboxMessageModel[]> {
        return this.repository.manager.transaction(
            async (transactionalEntityManager) => {
                try {
                    // Using QueryBuilder with lock skipLocked for concurrency control
                    const messageIds = await transactionalEntityManager
                        .createQueryBuilder(OutboxMessageModel, 'outbox')
                        .select('outbox.uuid')
                        .setLock('pessimistic_write')
                        .setOnLocked('skip_locked')
                        .where('outbox.processed = :processed', {
                            processed: false,
                        })
                        .orderBy('outbox.createdAt', 'ASC')
                        .take(limit)
                        .getMany()
                        .then((messages) => messages.map((m) => m.uuid));

                    if (messageIds.length === 0) {
                        return [];
                    }

                    return await transactionalEntityManager
                        .createQueryBuilder(OutboxMessageModel, 'outbox')
                        .whereInIds(messageIds)
                        .leftJoinAndSelect('outbox.job', 'job')
                        .orderBy('outbox.createdAt', 'ASC')
                        .getMany();
                } catch (error) {
                    if (
                        error.name !== 'QueryFailedError' &&
                        error.name !== 'TransactionNotStartedError'
                    ) {
                        this.logger.error({
                            message:
                                'Failed to find unprocessed outbox messages',
                            context: OutboxMessageRepository.name,
                            error,
                        });
                    }
                    throw error;
                }
            },
        );
    }

    async markAsProcessed(messageId: string): Promise<void> {
        try {
            await this.repository.update(
                { uuid: messageId },
                {
                    processed: true,
                    processedAt: new Date(),
                },
            );

            this.logger.debug({
                message: 'Outbox message marked as processed',
                context: OutboxMessageRepository.name,
                metadata: { messageId },
            });
        } catch (error) {
            this.logger.error({
                message: 'Failed to mark outbox message as processed',
                context: OutboxMessageRepository.name,
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
                message: `Deleted ${result.affected} processed outbox messages`,
                context: OutboxMessageRepository.name,
                metadata: { olderThan: date },
            });

            return result.affected || 0;
        } catch (error) {
            this.logger.error({
                message: 'Failed to delete old outbox messages',
                context: OutboxMessageRepository.name,
                error,
            });
            throw error;
        }
    }
}
