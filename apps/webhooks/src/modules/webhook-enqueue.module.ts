import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LogModule } from '@libs/analytics/modules/log.module';
import { WorkflowQueueLoader } from '@libs/core/infrastructure/config/loaders/workflow-queue.loader';
import { OutboxMessageRepository } from '@libs/core/infrastructure/database/typeorm/repositories/outbox-message.repository';
import { WorkflowJobRepository } from '@libs/core/infrastructure/database/typeorm/repositories/workflow-job.repository';
import { OutboxMessageModel } from '@libs/core/infrastructure/database/typeorm/schema/outbox-message.model';
import { WorkflowJobModel } from '@libs/core/infrastructure/database/typeorm/schema/workflow-job.model';
import { RabbitMQWrapperModule } from '@libs/core/infrastructure/queue/rabbitmq.module';
import { EnqueueWebhookUseCase } from '@libs/platform/application/use-cases/webhook/enqueue-webhook.use-case';
import { JOB_QUEUE_SERVICE_TOKEN } from '@libs/workflow-queue/domain/contracts/job-queue.service.contract';
import { RabbitMQJobQueueService } from '@libs/workflow-queue/infrastructure/rabbitmq-job-queue.service';
import { TransactionalOutboxService } from '@libs/workflow-queue/infrastructure/transactional-outbox.service';

@Module({
    imports: [
        ConfigModule.forFeature(WorkflowQueueLoader),
        TypeOrmModule.forFeature([WorkflowJobModel, OutboxMessageModel]),
        RabbitMQWrapperModule.register(),
        LogModule,
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
