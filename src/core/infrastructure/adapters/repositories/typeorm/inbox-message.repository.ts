import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InboxMessageModel } from './schema/inbox-message.model';

@Injectable()
export class InboxMessageRepository {
    constructor(
        @InjectRepository(InboxMessageModel)
        private readonly repository: Repository<InboxMessageModel>,
    ) {}

    async create(data: {
        messageId: string;
        jobId: string;
    }): Promise<InboxMessageModel> {
        const message = this.repository.create({
            messageId: data.messageId,
            job: { uuid: data.jobId },
            processed: false,
        });

        return await this.repository.save(message);
    }

    async findByMessageId(
        messageId: string,
    ): Promise<InboxMessageModel | null> {
        return await this.repository.findOne({
            where: { messageId },
            relations: ['job'],
        });
    }

    async markAsProcessed(messageId: string): Promise<void> {
        await this.repository.update(
            { messageId },
            {
                processed: true,
                processedAt: new Date(),
            },
        );
    }
}

