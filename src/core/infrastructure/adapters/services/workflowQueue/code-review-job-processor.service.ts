import { Injectable, Inject } from '@nestjs/common';
import { IJobProcessorService } from '@/core/domain/workflowQueue/contracts/job-processor.service.contract';
import { CodeReviewJobRepository } from '@/core/infrastructure/adapters/repositories/typeorm/code-review-job.repository';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { JobStatus } from '@/core/domain/workflowQueue/enums/job-status.enum';
import { ErrorClassification } from '@/core/domain/workflowQueue/enums/error-classification.enum';
// Note: Pipeline integration will be implemented in next phase
// import { PipelineExecutor } from '@/core/infrastructure/adapters/services/pipeline/pipeline-executor.service';
// import { CodeReviewPipelineStrategy } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/strategies/code-review-pipeline.strategy';
// import { CodeReviewPipelineContext } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/context/code-review-pipeline.context';
import { IErrorClassifierService } from '@/core/domain/workflowQueue/contracts/error-classifier.service.contract';

@Injectable()
export class CodeReviewJobProcessorService implements IJobProcessorService {
    constructor(
        private readonly jobRepository: CodeReviewJobRepository,
        // Pipeline integration will be added in next phase
        // private readonly pipelineExecutor: PipelineExecutor,
        // private readonly pipelineStrategy: CodeReviewPipelineStrategy,
        @Inject('ERROR_CLASSIFIER_SERVICE')
        private readonly errorClassifier: IErrorClassifierService,
        private readonly logger: PinoLoggerService,
    ) {}

    async process(jobId: string): Promise<void> {
        const job = await this.jobRepository.findOne(jobId);

        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }

        const startTime = Date.now();

        try {
            // Adiciona histórico de execução
            await this.jobRepository.addExecutionHistory(jobId, {
                attemptNumber: job.retryCount + 1,
                status: JobStatus.PROCESSING,
                startedAt: new Date(),
            });

            // Atualiza status para PROCESSING
            await this.jobRepository.update(jobId, {
                status: JobStatus.PROCESSING,
                startedAt: new Date(),
            });

            // TODO: Integrar com pipeline existente
            // Por enquanto, apenas simula execução
            // A integração completa será feita na próxima fase
            this.logger.log({
                message: 'Processing code review job',
                context: CodeReviewJobProcessorService.name,
                metadata: {
                    jobId,
                    correlationId: job.correlationId,
                },
            });

            // Simula processamento
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const result = { success: true };

            // Marca como completo
            await this.markCompleted(jobId, result);

            const duration = Date.now() - startTime;

            this.logger.log({
                message: 'Code review job processed successfully',
                context: CodeReviewJobProcessorService.name,
                metadata: {
                    jobId,
                    correlationId: job.correlationId,
                    duration,
                },
            });
        } catch (error) {
            await this.handleFailure(jobId, error as Error);
            throw error;
        }
    }

    async handleFailure(jobId: string, error: Error): Promise<void> {
        const job = await this.jobRepository.findOne(jobId);

        if (!job) {
            return;
        }

        // Classifica erro
        const errorClassification = await this.errorClassifier.classify(error);

        const duration = job.startedAt
            ? Date.now() - job.startedAt.getTime()
            : undefined;

        // Adiciona histórico de execução
        await this.jobRepository.addExecutionHistory(jobId, {
            attemptNumber: job.retryCount + 1,
            status: JobStatus.FAILED,
            startedAt: job.startedAt || new Date(),
            completedAt: new Date(),
            durationMs: duration,
            errorType: errorClassification,
            errorMessage: error.message,
        });

        // Se erro é retryable e não excedeu max retries, agenda retry
        if (
            errorClassification === ErrorClassification.RETRYABLE &&
            job.retryCount < job.maxRetries
        ) {
            await this.jobRepository.update(jobId, {
                status: JobStatus.RETRYING,
                retryCount: job.retryCount + 1,
                errorClassification,
                lastError: error.message,
                scheduledAt: new Date(
                    Date.now() + this.calculateRetryDelay(job.retryCount),
                ),
            });

            this.logger.warn({
                message: 'Job failed, scheduled for retry',
                context: CodeReviewJobProcessorService.name,
                metadata: {
                    jobId,
                    retryCount: job.retryCount + 1,
                    maxRetries: job.maxRetries,
                },
            });
        } else {
            // Erro não retryable ou excedeu max retries
            await this.jobRepository.update(jobId, {
                status: JobStatus.FAILED,
                errorClassification,
                lastError: error.message,
                completedAt: new Date(),
            });

            this.logger.error({
                message: 'Job failed permanently',
                context: CodeReviewJobProcessorService.name,
                error,
                metadata: {
                    jobId,
                    errorClassification,
                    retryCount: job.retryCount,
                },
            });
        }
    }

    async markCompleted(jobId: string, result?: unknown): Promise<void> {
        const duration =
            Date.now() -
                (
                    await this.jobRepository.findOne(jobId)
                )?.startedAt?.getTime() || 0;

        await this.jobRepository.addExecutionHistory(jobId, {
            attemptNumber:
                (await this.jobRepository.findOne(jobId))?.retryCount || 0,
            status: JobStatus.COMPLETED,
            startedAt:
                (await this.jobRepository.findOne(jobId))?.startedAt ||
                new Date(),
            completedAt: new Date(),
            durationMs: duration,
        });

        await this.jobRepository.update(jobId, {
            status: JobStatus.COMPLETED,
            completedAt: new Date(),
        });
    }

    private calculateRetryDelay(retryCount: number): number {
        // Backoff exponencial: 1s, 2s, 4s, 8s...
        return Math.min(1000 * Math.pow(2, retryCount), 60000); // Max 60s
    }
}
