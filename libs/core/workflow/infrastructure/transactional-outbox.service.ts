import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createLogger } from '@kodus/flow';
import { OutboxMessageRepository } from './repositories/outbox-message.repository';
import { OutboxMessageModel } from './repositories/schemas';

export interface OutboxMessage {
    jobId: string;
    exchange: string;
    routingKey: string;
    payload: Record<string, unknown>;
}

@Injectable()
export class TransactionalOutboxService {
    private readonly logger = createLogger(TransactionalOutboxService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly outboxRepository: OutboxMessageRepository,
    ) {}

    /**
     * Salva mensagem no outbox dentro de uma transação existente
     * Deve ser chamado dentro de uma transação do DataSource
     */
    async saveInTransaction(
        manager: EntityManager,
        message: OutboxMessage,
    ): Promise<void> {
        const outboxMessage = manager.create(OutboxMessageModel, {
            job: { uuid: message.jobId },
            exchange: message.exchange,
            routingKey: message.routingKey,
            payload: message.payload,
            processed: false,
        });

        await manager.save(OutboxMessageModel, outboxMessage);

        this.logger.log({
            message: 'Outbox message saved in transaction',
            context: TransactionalOutboxService.name,
            metadata: {
                jobId: message.jobId,
                exchange: message.exchange,
                routingKey: message.routingKey,
            },
        });
    }

    /**
     * Salva mensagem no outbox criando uma nova transação
     * Use apenas se não estiver dentro de uma transação existente
     */
    async save(message: OutboxMessage): Promise<void> {
        await this.outboxRepository.create(message);
    }
}
