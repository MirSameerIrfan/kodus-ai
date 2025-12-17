import * as dotenv from 'dotenv';
dotenv.config();

import { Module, forwardRef, DynamicModule } from '@nestjs/common';
import { CodeReviewPipelineModule } from '@libs/code-review/pipeline/code-review-pipeline.module';
import { CodebaseModule } from '@libs/code-review/modules/codebase.module';
import { RabbitMQWrapperModule } from '@libs/core/infrastructure/queue/rabbitmq.module';
import { WorkflowCoreModule } from './workflow-core.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';

// Engine
import { HeavyStageEventHandler } from './engine/heavy-stage-event.handler';

// Infrastructure - Services
import { WorkflowJobQueueService } from './infrastructure/workflow-job-queue.service';
import { WorkflowJobConsumer } from './infrastructure/workflow-job-consumer.service';
import { WorkflowResumedConsumer } from './infrastructure/workflow-resumed-consumer.service';
import { DistributedLockService } from './infrastructure/distributed-lock.service';
import { ErrorClassifierService } from './infrastructure/error-classifier.service';
import { JobProcessorRouterService } from './infrastructure/job-processor-router.service';
import { WebhookProcessingJobProcessorService } from '@libs/automation/webhook-processing/webhook-processing-job.processor';
import { OutboxRelayService } from './infrastructure/outbox-relay.service';

// Domain contracts
import { JOB_QUEUE_SERVICE_TOKEN } from './domain/contracts/job-queue.service.contract';
import { JOB_PROCESSOR_SERVICE_TOKEN } from './domain/contracts/job-processor.service.contract';
import { ERROR_CLASSIFIER_SERVICE_TOKEN } from './domain/contracts/error-classifier.service.contract';

// Use Cases
import { EnqueueCodeReviewJobUseCase } from './application/use-cases/enqueue-code-review-job.use-case';
import { ProcessWorkflowJobUseCase } from './application/use-cases/process-workflow-job.use-case';
import { GetJobStatusUseCase } from './application/use-cases/get-job-status.use-case';
import { CodeReviewValidationService } from '@libs/automation/infrastructure/adapters/services/code-review-validation.service';
import { AutomationModule } from '@libs/automation/modules/automation.module';
import { ASTEventHandler } from './infrastructure/ast-event-handler.service';

// Config
import { WORKFLOW_QUEUE_CONFIG } from './infrastructure/config/rabbitmq.config';

const sharedProviders = [
    {
        provide: JOB_QUEUE_SERVICE_TOKEN,
        useClass: WorkflowJobQueueService,
    },

    EnqueueCodeReviewJobUseCase,
    GetJobStatusUseCase,
    CodeReviewValidationService,
];

const sharedExports = [
    JOB_QUEUE_SERVICE_TOKEN,
    EnqueueCodeReviewJobUseCase,
    GetJobStatusUseCase,
    CodeReviewValidationService,
];

const workerProviders = [
    // Engine - Worker specific
    HeavyStageEventHandler,

    // Services
    {
        provide: JOB_PROCESSOR_SERVICE_TOKEN,
        useClass: JobProcessorRouterService,
    },
    {
        provide: ERROR_CLASSIFIER_SERVICE_TOKEN,
        useClass: ErrorClassifierService,
    },
    DistributedLockService,
    JobProcessorRouterService,
    ASTEventHandler,
    OutboxRelayService,

    // Processors
    WebhookProcessingJobProcessorService,

    // Consumers
    WorkflowJobConsumer,
    WorkflowResumedConsumer,

    // Use Cases
    ProcessWorkflowJobUseCase,
];

import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { SharedMongoModule } from '@libs/shared/database/shared-mongo.module';

@Module({})
export class WorkflowModule {
    static register(options: {
        type: 'worker' | 'api' | 'webhook';
    }): DynamicModule {
        const isWorker = options.type === 'worker';

        const imports: any[] = [
            WorkflowCoreModule,
            forwardRef(() => CodeReviewPipelineModule),
            forwardRef(() => CodebaseModule),
            forwardRef(() => PlatformModule),
            forwardRef(() => AutomationModule),
            forwardRef(() => IntegrationConfigCoreModule),
            forwardRef(() => PermissionValidationModule),
            SharedMongoModule, // Ensure MongoDB is available for worker
        ];

        // Use standard wrapper module instead of manual configuration
        imports.push(
            RabbitMQWrapperModule.register({
                enableConsumers: isWorker,
                queues: WORKFLOW_QUEUE_CONFIG.queues,
                exchanges: WORKFLOW_QUEUE_CONFIG.exchanges,
            }),
        );

        return {
            module: WorkflowModule,
            imports: imports,
            providers: [
                ...sharedProviders,
                ...(isWorker ? workerProviders : []),
            ],
            exports: [
                WorkflowCoreModule,
                ...sharedExports,
                RabbitMQWrapperModule, // Re-export the wrapper
                ...(isWorker ? workerProviders : []),
            ],
        };
    }
}
