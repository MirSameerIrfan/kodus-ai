import { Injectable, Inject } from '@nestjs/common';
import { IUseCase } from '@shared/domain/interfaces/use-case.interface';
import { PinoLoggerService } from '@shared/logging/pino.service';
import {
    IJobQueueService,
    JOB_QUEUE_SERVICE_TOKEN,
} from '@libs/workflow-queue/domain/contracts/job-queue.service.contract';
import { PlatformType } from '@shared/domain/enums/platform-type.enum';
import { JobStatus } from '@libs/workflow-queue/domain/enums/job-status.enum';
import { WorkflowType } from '@libs/workflow-queue/domain/enums/workflow-type.enum';
import { HandlerType } from '@libs/workflow-queue/domain/enums/handler-type.enum';
import { v4 as uuid } from 'uuid';

export interface EnqueueCodeReviewJobInput {
    platformType: PlatformType;
    repositoryId: string;
    repositoryName: string;
    pullRequestNumber: number;
    pullRequestData: Record<string, unknown>;
    organizationId: string;
    teamId: string;
}

@Injectable()
export class EnqueueCodeReviewJobUseCase implements IUseCase {
    constructor(
        @Inject(JOB_QUEUE_SERVICE_TOKEN)
        private readonly jobQueueService: IJobQueueService,
        private readonly logger: PinoLoggerService,
    ) {}

    async execute(input: EnqueueCodeReviewJobInput): Promise<string> {
        try {
            const correlationId = uuid();

            this.logger.log({
                message: 'Enqueuing code review job',
                context: EnqueueCodeReviewJobUseCase.name,
                metadata: {
                    correlationId,
                    platformType: input.platformType,
                    repositoryId: input.repositoryId,
                    pullRequestNumber: input.pullRequestNumber,
                },
            });

            // Cria WorkflowJob genérico com dados do code review no payload
            const jobId = await this.jobQueueService.enqueue({
                correlationId,
                workflowType: WorkflowType.CODE_REVIEW,
                handlerType: HandlerType.PIPELINE_SYNC,
                payload: {
                    platformType: input.platformType,
                    repositoryId: input.repositoryId,
                    repositoryName: input.repositoryName,
                    pullRequestNumber: input.pullRequestNumber,
                    pullRequestData: input.pullRequestData,
                },
                organizationId: input.organizationId,
                teamId: input.teamId,
                status: JobStatus.PENDING,
                priority: 0,
                retryCount: 0,
                maxRetries: 3,
            });

            this.logger.log({
                message: 'Code review job enqueued successfully',
                context: EnqueueCodeReviewJobUseCase.name,
                metadata: {
                    jobId,
                    correlationId,
                },
            });

            return jobId;
        } catch (error) {
            this.logger.error({
                message: 'Failed to enqueue code review job',
                context: EnqueueCodeReviewJobUseCase.name,
                error,
                metadata: {
                    input,
                },
            });
            throw error;
        }
    }
}
