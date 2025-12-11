import { createLogger } from '@kodus/flow';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { InboxMessageRepository } from './repositories/inbox-message.repository';
import { InboxMessageModel } from './repositories/schemas/inbox-message.model';

@Injectable()
export class TransactionalInboxService {
    private readonly logger = createLogger(TransactionalInboxService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly inboxRepository: InboxMessageRepository,
    ) {}

    /**
     * Tenta salvar mensagem no inbox dentro de uma transação
     * Retorna true se mensagem é nova (não duplicada), false se já existe
     * Deve ser chamado dentro de uma transação do DataSource
     */
    async saveInTransaction(
        manager: EntityManager,
        messageId: string,
        jobId: string,
    ): Promise<boolean> {
        try {
            // Tentar criar - se messageId já existe, vai dar erro de unique constraint
            const inboxMessage = manager.create(InboxMessageModel, {
                messageId,
                job: { uuid: jobId },
                processed: false,
            });

            await manager.save(InboxMessageModel, inboxMessage);

            this.logger.log({
                message: 'Inbox message saved (new message)',
                context: TransactionalInboxService.name,
                metadata: {
                    messageId,
                    jobId,
                },
            });

            return true; // Mensagem nova
        } catch (error: any) {
            // Se erro é de constraint única, mensagem já foi processada
            if (error.code === '23505') {
                // Unique constraint violation
                this.logger.warn({
                    message: 'Duplicate message detected in inbox',
                    context: TransactionalInboxService.name,
                    metadata: {
                        messageId,
                        jobId,
                    },
                });

                return false; // Mensagem duplicada
            }

            // Outro erro - re-throw
            throw error;
        }
    }

    /**
     * Verifica se mensagem já foi processada (sem criar transação)
     */
    async isProcessed(messageId: string): Promise<boolean> {
        const existing = await this.inboxRepository.findByMessageId(messageId);
        return existing !== null;
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

        this.logger.debug({
            message: 'Inbox message marked as processed in transaction',
            context: TransactionalInboxService.name,
            metadata: { messageId, consumerId },
        });
    }
}
