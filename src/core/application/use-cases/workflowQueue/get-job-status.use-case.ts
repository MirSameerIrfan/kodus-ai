import { Injectable, Inject } from '@nestjs/common';
import { IUseCase } from '@/shared/domain/interfaces/use-case.interface';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import {
    IJobStatusService,
    JOB_STATUS_SERVICE_TOKEN,
} from '@/core/domain/workflowQueue/contracts/job-status.service.contract';
import { ICodeReviewJob } from '@/core/domain/workflowQueue/interfaces/code-review-job.interface';

export interface GetJobStatusInput {
    jobId: string;
}

export interface GetJobStatusOutput {
    job: ICodeReviewJob | null;
    executionHistory: Array<{
        id: string;
        attemptNumber: number;
        status: string;
        startedAt: Date;
        completedAt?: Date;
        durationMs?: number;
        errorType?: string;
        errorMessage?: string;
    }>;
}

@Injectable()
export class GetJobStatusUseCase implements IUseCase {
    constructor(
        @Inject(JOB_STATUS_SERVICE_TOKEN)
        private readonly jobStatusService: IJobStatusService,
        private readonly logger: PinoLoggerService,
    ) {}

    async execute(input: GetJobStatusInput): Promise<GetJobStatusOutput> {
        try {
            const detail = await this.jobStatusService.getJobDetail(
                input.jobId,
            );

            if (!detail) {
                return {
                    job: null,
                    executionHistory: [],
                };
            }

            return {
                job: detail.job,
                executionHistory: detail.executionHistory.map((h) => ({
                    id: h.id,
                    attemptNumber: h.attemptNumber,
                    status: h.status,
                    startedAt: h.startedAt,
                    completedAt: h.completedAt,
                    durationMs: h.durationMs,
                    errorType: h.errorType,
                    errorMessage: h.errorMessage,
                })),
            };
        } catch (error) {
            this.logger.error({
                message: 'Failed to get job status',
                context: GetJobStatusUseCase.name,
                error,
                metadata: {
                    jobId: input.jobId,
                },
            });
            throw error;
        }
    }
}
