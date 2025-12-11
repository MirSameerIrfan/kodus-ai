import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';

import { createLogger } from '@kodus/flow';
import { OutboxMessage } from '../transactional-outbox.service';

import { OutboxMessageModel } from './schemas/outbox-message.model';

@Injectable()
export class OutboxMessageRepository {
    private readonly logger = createLogger(OutboxMessageRepository.name);

    constructor(
        @InjectRepository(OutboxMessageModel)
        private readonly repository: Repository<OutboxMessageModel>,
    ) {}

    async create(message: OutboxMessage): Promise<OutboxMessageModel> {
        try {
            const model = this.repository.create({
                job: message.jobId ? { uuid: message.jobId } : undefined,
                exchange: message.exchange,
                routingKey: message.routingKey,
                payload: message.payload,
                processed: false,
            });

            const saved = await this.repository.save(model);

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

    async findUnprocessed(limit: number = 100): Promise<OutboxMessageModel[]> {
        try {
            return await this.repository.find({
                where: { processed: false },
                order: { createdAt: 'ASC' },
                take: limit,
                relations: ['job'],
            });
        } catch (error) {
            this.logger.error({
                message: 'Failed to find unprocessed outbox messages',
                context: OutboxMessageRepository.name,
                error,
            });
            throw error;
        }
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
