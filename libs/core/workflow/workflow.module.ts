import * as dotenv from 'dotenv';
dotenv.config();

import { Module, forwardRef, DynamicModule } from '@nestjs/common';
import { CodeReviewPipelineModule } from '@libs/code-review/pipeline/code-review-pipeline.module';
import { CodebaseModule } from '@libs/code-review/modules/codebase.module';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { WorkflowCoreModule } from './workflow-core.module';

// Engine
import { HeavyStageEventHandler } from './engine/heavy-stage-event.handler';

// Infrastructure - Services
import { RabbitMQJobQueueService } from './infrastructure/rabbitmq-job-queue.service';
import { WorkflowJobConsumer } from './infrastructure/workflow-job-consumer.service';
import { WorkflowResumedConsumer } from './infrastructure/workflow-resumed-consumer.service';
import { DistributedLockService } from './infrastructure/distributed-lock.service';
import { ErrorClassifierService } from './infrastructure/error-classifier.service';
import { JobProcessorRouterService } from './infrastructure/job-processor-router.service';
import { ASTEventHandler } from './infrastructure/ast-event-handler.service';
import { WebhookProcessingJobProcessorService } from '@libs/automation/webhook-processing/webhook-processing-job.processor';

// Domain contracts
import { JOB_QUEUE_SERVICE_TOKEN } from './domain/contracts/job-queue.service.contract';
import { JOB_PROCESSOR_SERVICE_TOKEN } from './domain/contracts/job-processor.service.contract';
import { ERROR_CLASSIFIER_SERVICE_TOKEN } from './domain/contracts/error-classifier.service.contract';

// Use Cases
import { EnqueueCodeReviewJobUseCase } from './application/use-cases/enqueue-code-review-job.use-case';
import { ProcessWorkflowJobUseCase } from './application/use-cases/process-workflow-job.use-case';
import { GetJobStatusUseCase } from './application/use-cases/get-job-status.use-case';
import { GithubModule } from '@libs/platform/modules/github.module';
import { GitlabModule } from '@libs/platform/modules/gitlab.module';
import { BitbucketModule } from '@libs/platform/modules/bitbucket.module';
import { AzureReposModule } from '@libs/platform/modules/azure-repos.module';
import { CodeReviewValidationService } from '@libs/code-review/infrastructure/adapters/services/code-review-validation.service';
import { AutomationModule } from '@libs/automation/modules/automation.module';

const sharedProviders = [
    // Infrastructure Services
    {
        provide: JOB_QUEUE_SERVICE_TOKEN,
        useClass: RabbitMQJobQueueService,
    },

    // Use Cases
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
            forwardRef(() => GithubModule),
            forwardRef(() => GitlabModule),
            forwardRef(() => BitbucketModule),
            forwardRef(() => AzureReposModule),
            forwardRef(() => AutomationModule),
            forwardRef(() => IntegrationConfigCoreModule),
            forwardRef(() => PermissionValidationModule),
            SharedMongoModule, // Ensure MongoDB is available for worker
        ];

        console.log(
            `[WorkflowModule] Initializing. API_RABBITMQ_ENABLED=${process.env.API_RABBITMQ_ENABLED}, type=${options.type}`,
        );

        if (process.env.API_RABBITMQ_ENABLED !== 'false') {
            console.log(
                '[WorkflowModule] RabbitMQ is ENABLED. Importing RabbitMQModule.',
            );
            imports.push(
                RabbitMQModule.forRoot({
                    exchanges: [
                        {
                            name: 'workflow.events',
                            type: 'topic',
                        },
                        {
                            name: 'workflow.exchange',
                            type: 'topic',
                        },
                    ],
                    uri:
                        process.env.RABBITMQ_URI ||
                        'amqp://guest:guest@localhost:5672',
                    connectionInitOptions: { wait: false },
                }),
            );
        } else {
            console.log(
                '[WorkflowModule] RabbitMQ is DISABLED. Skipping RabbitMQModule import.',
            );
        }

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
                ...(process.env.API_RABBITMQ_ENABLED !== 'false'
                    ? [RabbitMQModule]
                    : []),
                ...(isWorker ? workerProviders : []),
            ],
        };
    }
}
