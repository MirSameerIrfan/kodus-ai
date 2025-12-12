import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkflowQueueLoader } from '@libs/core/infrastructure/config/loaders/workflow-queue.loader';

import { RabbitMQWrapperModule } from '@libs/core/infrastructure/queue/rabbitmq.module';
import { EnqueueWebhookUseCase } from '@libs/platform/application/use-cases/webhook/enqueue-webhook.use-case';
import { JOB_QUEUE_SERVICE_TOKEN } from '@libs/core/workflow/domain/contracts/job-queue.service.contract';
import { RabbitMQJobQueueService } from '@libs/core/workflow/infrastructure/rabbitmq-job-queue.service';
import { TransactionalOutboxService } from '@libs/core/workflow/infrastructure/transactional-outbox.service';
import { WorkflowJobRepository } from '@libs/core/workflow/infrastructure/repositories/workflow-job.repository';
import { OutboxMessageRepository } from '@libs/core/workflow/infrastructure/repositories/outbox-message.repository';
import { WorkflowJobModel } from '@libs/core/workflow/infrastructure/repositories/schemas/workflow-job.model';
import { OutboxMessageModel } from '@libs/core/workflow/infrastructure/repositories/schemas/outbox-message.model';

@Module({
    imports: [
        ConfigModule.forFeature(WorkflowQueueLoader),
        TypeOrmModule.forFeature([WorkflowJobModel, OutboxMessageModel]),
        RabbitMQWrapperModule.register(),
    ],
    providers: [
        WorkflowJobRepository,
        OutboxMessageRepository,
        TransactionalOutboxService,
        RabbitMQJobQueueService,
        {
            provide: JOB_QUEUE_SERVICE_TOKEN,
            useClass: RabbitMQJobQueueService,
        },
        EnqueueWebhookUseCase,
    ],
    exports: [EnqueueWebhookUseCase],
})
export class WebhookEnqueueModule {}
