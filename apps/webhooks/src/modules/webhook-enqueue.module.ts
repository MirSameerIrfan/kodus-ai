import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitMQWrapperModule } from '@/modules/rabbitmq.module';
import { LogModule } from '@/modules/log.module';
import { JOB_QUEUE_SERVICE_TOKEN } from '@/core/domain/workflowQueue/contracts/job-queue.service.contract';
import { RabbitMQJobQueueService } from '@/core/infrastructure/adapters/services/workflowQueue/rabbitmq-job-queue.service';
import { WorkflowQueueLoader } from '@/config/loaders/workflow-queue.loader';
import { WorkflowJobModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/workflow-job.model';
import { OutboxMessageModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/outbox-message.model';
import { WorkflowJobRepository } from '@/core/infrastructure/adapters/repositories/typeorm/workflow-job.repository';
import { OutboxMessageRepository } from '@/core/infrastructure/adapters/repositories/typeorm/outbox-message.repository';
import { TransactionalOutboxService } from '@/core/infrastructure/adapters/services/workflowQueue/transactional-outbox.service';
import { EnqueueWebhookUseCase } from '@/core/application/use-cases/webhook/enqueue-webhook.use-case';

/**
 * WebhookEnqueueModule - Módulo Mínimo para Enfileirar Webhooks
 *
 * Este módulo contém apenas o necessário para enfileirar webhooks:
 * - EnqueueWebhookUseCase (enfileira payload bruto na fila)
 * - RabbitMQWrapperModule (conexão RabbitMQ)
 * - LogModule (logging)
 * - Dependências para Transactional Outbox (WorkflowJobRepository, OutboxMessageRepository, TransactionalOutboxService)
 *
 * NÃO inclui:
 * - Processamento de webhooks (workers fazem isso)
 * - Validação de organização/team (workers fazem isso)
 * - Decisão de qual handler usar (workers fazem isso)
 * - Lógica de negócio (workers fazem isso)
 *
 * Tamanho: ~2-3MB
 */
@Module({
    imports: [
        ConfigModule.forFeature(WorkflowQueueLoader),
        TypeOrmModule.forFeature([WorkflowJobModel, OutboxMessageModel]),
        RabbitMQWrapperModule.register(), // Para AmqpConnection
        LogModule, // Para PinoLoggerService (@Global)
    ],
    providers: [
        // Repositories
        WorkflowJobRepository,
        OutboxMessageRepository,
        // Services
        TransactionalOutboxService,
        RabbitMQJobQueueService,
        // Token provider
        {
            provide: JOB_QUEUE_SERVICE_TOKEN,
            useClass: RabbitMQJobQueueService,
        },
        // Use Case
        EnqueueWebhookUseCase,
    ],
    exports: [EnqueueWebhookUseCase],
})
export class WebhookEnqueueModule {}
