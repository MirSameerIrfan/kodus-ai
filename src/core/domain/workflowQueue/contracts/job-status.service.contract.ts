import { ICodeReviewJob } from '../interfaces/code-review-job.interface';
import { IJobExecutionHistory } from '../interfaces/code-review-job.interface';

export const JOB_STATUS_SERVICE_TOKEN = Symbol('JobStatusService');

export interface IJobStatusService {
    getJobStatus(jobId: string): Promise<ICodeReviewJob | null>;

    getJobDetail(jobId: string): Promise<{
        job: ICodeReviewJob;
        executionHistory: IJobExecutionHistory[];
    } | null>;

    getMetrics(): Promise<{
        queueSize: number;
        processingCount: number;
        completedToday: number;
        failedToday: number;
        averageProcessingTime: number;
        successRate: number;
        byStatus: Record<string, number>;
    }>;
}
