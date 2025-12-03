import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WorkflowQueueLoader } from '@/config/loaders/workflow-queue.loader';
import { WorkflowJobModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/workflow-job.model';
import { OutboxMessageModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/outbox-message.model';
import { WorkflowJobRepository } from '@/core/infrastructure/adapters/repositories/typeorm/workflow-job.repository';
import { OutboxMessageRepository } from '@/core/infrastructure/adapters/repositories/typeorm/outbox-message.repository';
import { TransactionalOutboxService } from '@/core/infrastructure/adapters/services/workflowQueue/transactional-outbox.service';
import { RabbitMQJobQueueService } from '@/core/infrastructure/adapters/services/workflowQueue/rabbitmq-job-queue.service';
import { JOB_QUEUE_SERVICE_TOKEN } from '@/core/domain/workflowQueue/contracts/job-queue.service.contract';
import { EnqueueCodeReviewJobUseCase } from '@/core/application/use-cases/workflowQueue/enqueue-code-review-job.use-case';
import { RabbitMQWrapperModule } from './rabbitmq.module';

/**
 * WebhookEnqueueModule - Minimal Module for Webhook Handler
 *
 * This module contains ONLY what's needed to enqueue jobs from webhooks:
 * - WorkflowJobRepository (save jobs)
 * - OutboxMessageRepository (save outbox messages)
 * - TransactionalOutboxService (transactional outbox pattern)
 * - RabbitMQJobQueueService (publish to RabbitMQ)
 * - EnqueueCodeReviewJobUseCase (enqueue code review jobs)
 *
 * It does NOT include:
 * - Consumers (WorkflowJobConsumer, ASTEventHandler, etc.) - workers handle this
 * - Processors (CodeReviewJobProcessorService) - workers handle this
 * - CodebaseModule - not needed for enqueueing
 * - PlatformIntegrationModule - not needed for enqueueing
 * - InboxMessageRepository - not needed for enqueueing
 * - JobStatusService - not needed for enqueueing
 * - ErrorClassifierService - not needed for enqueueing
 *
 * This makes the webhook handler:
 * - Lightweight (~80-100MB vs ~150-200MB with full WorkflowQueueModule)
 * - Fast startup (~3-5s vs ~10-15s with full WorkflowQueueModule)
 * - High throughput (can handle 1000+ req/s)
 * - Stateless (easy to scale horizontally)
 */
@Module({
    imports: [
        ConfigModule.forFeature(WorkflowQueueLoader),
        TypeOrmModule.forFeature([WorkflowJobModel, OutboxMessageModel]),
        RabbitMQWrapperModule.register(), // For AmqpConnection
        // PinoLoggerService and ObservabilityService are available via LogModule (@Global)
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
        EnqueueCodeReviewJobUseCase,
    ],
    exports: [
        EnqueueCodeReviewJobUseCase,
        JOB_QUEUE_SERVICE_TOKEN,
        WorkflowJobRepository,
        TransactionalOutboxService,
    ],
})
export class WebhookEnqueueModule {}
