import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxMessageModel } from '@core/database/typeorm/schema/outbox-message.model';

@Injectable()
export class OutboxMessageRepository {
    constructor(
        @InjectRepository(OutboxMessageModel)
        private readonly repository: Repository<OutboxMessageModel>,
    ) {}

    async create(data: {
        jobId: string;
        exchange: string;
        routingKey: string;
        payload: Record<string, unknown>;
    }): Promise<OutboxMessageModel> {
        const message = this.repository.create({
            job: { uuid: data.jobId },
            exchange: data.exchange,
            routingKey: data.routingKey,
            payload: data.payload,
            processed: false,
        });

        return await this.repository.save(message);
    }

    async findUnprocessed(limit: number = 100): Promise<OutboxMessageModel[]> {
        return await this.repository.find({
            where: { processed: false },
            order: { createdAt: 'ASC' },
            take: limit,
            relations: ['job'],
        });
    }

    async markAsProcessed(messageId: string): Promise<void> {
        await this.repository.update(
            { uuid: messageId },
            {
                processed: true,
                processedAt: new Date(),
            },
        );
    }

    async countUnprocessed(): Promise<number> {
        return await this.repository.count({
            where: { processed: false },
        });
    }
}

