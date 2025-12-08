import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { InboxMessageRepository } from '@libs/core/database/typeorm/repositories/inbox-message.repository';
import { InboxMessageModel } from '@libs/core/database/typeorm/repositories/schema/inbox-message.model';
import { PinoLoggerService } from '@libs/common/logging/pino.service';

@Injectable()
export class TransactionalInboxService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly inboxRepository: InboxMessageRepository,
        private readonly logger: PinoLoggerService,
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
}
