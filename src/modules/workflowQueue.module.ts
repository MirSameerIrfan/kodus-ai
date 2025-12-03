import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WorkflowQueueLoader } from '@/config/loaders/workflow-queue.loader';
import { WorkflowJobModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/workflow-job.model';
import { JobExecutionHistoryModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/job-execution-history.model';
import { OutboxMessageModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/outbox-message.model';
import { InboxMessageModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/inbox-message.model';
import { WorkflowJobRepository } from '@/core/infrastructure/adapters/repositories/typeorm/workflow-job.repository';
import { OutboxMessageRepository } from '@/core/infrastructure/adapters/repositories/typeorm/outbox-message.repository';
import { InboxMessageRepository } from '@/core/infrastructure/adapters/repositories/typeorm/inbox-message.repository';
import { TransactionalOutboxService } from '@/core/infrastructure/adapters/services/workflowQueue/transactional-outbox.service';
import { TransactionalInboxService } from '@/core/infrastructure/adapters/services/workflowQueue/transactional-inbox.service';
import { OutboxRelayService } from '@/core/infrastructure/adapters/services/workflowQueue/outbox-relay.service';
import { WorkflowJobConsumer } from '@/core/infrastructure/adapters/services/workflowQueue/workflow-job-consumer.service';
import { ASTEventHandler } from '@/core/infrastructure/adapters/services/workflowQueue/ast-event-handler.service';
import { WorkflowResumedConsumer } from '@/core/infrastructure/adapters/services/workflowQueue/workflow-resumed-consumer.service';
import { RabbitMQJobQueueService } from '@/core/infrastructure/adapters/services/workflowQueue/rabbitmq-job-queue.service';
import { ErrorClassifierService } from '@/core/infrastructure/adapters/services/workflowQueue/error-classifier.service';
import { JobStatusService } from '@/core/infrastructure/adapters/services/workflowQueue/job-status.service';
import { CodeReviewJobProcessorService } from '@/core/infrastructure/adapters/services/workflowQueue/code-review-job-processor.service';
import { JOB_QUEUE_SERVICE_TOKEN } from '@/core/domain/workflowQueue/contracts/job-queue.service.contract';
import { JOB_STATUS_SERVICE_TOKEN } from '@/core/domain/workflowQueue/contracts/job-status.service.contract';
import { ERROR_CLASSIFIER_SERVICE_TOKEN } from '@/core/domain/workflowQueue/contracts/error-classifier.service.contract';
import { JOB_PROCESSOR_SERVICE_TOKEN } from '@/core/domain/workflowQueue/contracts/job-processor.service.contract';
import { EnqueueCodeReviewJobUseCase } from '@/core/application/use-cases/workflowQueue/enqueue-code-review-job.use-case';
import { ProcessWorkflowJobUseCase } from '@/core/application/use-cases/workflowQueue/process-workflow-job.use-case';
import { WorkflowQueueController } from '@/core/infrastructure/http/controllers/workflow-queue.controller';
import { forwardRef } from '@nestjs/common';
import { CodebaseModule } from './codeBase.module';
import { PlatformIntegrationModule } from './platformIntegration.module';

@Module({
    imports: [
        ConfigModule.forFeature(WorkflowQueueLoader),
        TypeOrmModule.forFeature([
            WorkflowJobModel,
            JobExecutionHistoryModel,
            OutboxMessageModel,
            InboxMessageModel,
        ]),
        forwardRef(() => CodebaseModule), // Para CodeReviewHandlerService
        forwardRef(() => PlatformIntegrationModule), // Para RunCodeReviewAutomationUseCase (via GithubModule/GitlabModule/etc)
        // PinoLoggerService e ObservabilityService já estão disponíveis via LogModule (@Global)
    ],
    providers: [
        // Repositories
        WorkflowJobRepository,
        OutboxMessageRepository,
        InboxMessageRepository,
        // Services
        TransactionalOutboxService,
        TransactionalInboxService,
        OutboxRelayService,
        ErrorClassifierService,
        JobStatusService,
        RabbitMQJobQueueService,
        CodeReviewJobProcessorService,
               // Consumers
               WorkflowJobConsumer,
               ASTEventHandler,
               WorkflowResumedConsumer,
               // Token providers
        {
            provide: JOB_QUEUE_SERVICE_TOKEN,
            useClass: RabbitMQJobQueueService,
        },
        {
            provide: JOB_STATUS_SERVICE_TOKEN,
            useClass: JobStatusService,
        },
        {
            provide: ERROR_CLASSIFIER_SERVICE_TOKEN,
            useClass: ErrorClassifierService,
        },
        {
            provide: JOB_PROCESSOR_SERVICE_TOKEN,
            useClass: CodeReviewJobProcessorService,
        },
        // Use Cases
        EnqueueCodeReviewJobUseCase,
        ProcessWorkflowJobUseCase,
    ],
    controllers: [WorkflowQueueController],
    exports: [
        JOB_QUEUE_SERVICE_TOKEN,
        JOB_STATUS_SERVICE_TOKEN,
        ERROR_CLASSIFIER_SERVICE_TOKEN,
        WorkflowJobRepository,
        TransactionalOutboxService,
        TransactionalInboxService,
        EnqueueCodeReviewJobUseCase,
    ],
})
export class WorkflowQueueModule {}
