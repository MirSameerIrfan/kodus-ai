import { ICodeReviewJob } from '../interfaces/code-review-job.interface';

export const JOB_PROCESSOR_SERVICE_TOKEN = Symbol('JobProcessorService');

export interface IJobProcessorService {
    process(jobId: string): Promise<void>;

    handleFailure(jobId: string, error: Error): Promise<void>;

    markCompleted(jobId: string, result?: unknown): Promise<void>;
}
