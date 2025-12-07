import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { OutboxMessageRepository } from '@core/database/typeorm/repositories/outbox-message.repository';
import { OutboxMessageModel } from '@core/database/typeorm/repositories/schema/outbox-message.model';
import { PinoLoggerService } from '@shared/logging/pino.service';

export interface OutboxMessage {
    jobId: string;
    exchange: string;
    routingKey: string;
    payload: Record<string, unknown>;
}

@Injectable()
export class TransactionalOutboxService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly outboxRepository: OutboxMessageRepository,
        private readonly logger: PinoLoggerService,
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

