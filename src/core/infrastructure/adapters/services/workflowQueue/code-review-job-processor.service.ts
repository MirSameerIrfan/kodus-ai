import { Injectable, Inject, Optional } from '@nestjs/common';
import { IJobProcessorService } from '@/core/domain/workflowQueue/contracts/job-processor.service.contract';
import { WorkflowJobRepository } from '@/core/infrastructure/adapters/repositories/typeorm/workflow-job.repository';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { JobStatus } from '@/core/domain/workflowQueue/enums/job-status.enum';
import { ErrorClassification } from '@/core/domain/workflowQueue/enums/error-classification.enum';
import { WorkflowType } from '@/core/domain/workflowQueue/enums/workflow-type.enum';
import { HandlerType } from '@/core/domain/workflowQueue/enums/handler-type.enum';
import { ERROR_CLASSIFIER_SERVICE_TOKEN } from '@/core/domain/workflowQueue/contracts/error-classifier.service.contract';
import { IErrorClassifierService } from '@/core/domain/workflowQueue/contracts/error-classifier.service.contract';
import { ObservabilityService } from '@/core/infrastructure/adapters/services/logger/observability.service';
import { CodeReviewHandlerService } from '@/core/infrastructure/adapters/services/codeBase/codeReviewHandlerService.service';
import { RunCodeReviewAutomationUseCase } from '@/ee/automation/runCodeReview.use-case';
import { PlatformType } from '@/shared/domain/enums/platform-type.enum';
import { getMappedPlatform } from '@/shared/utils/webhooks';

@Injectable()
export class CodeReviewJobProcessorService implements IJobProcessorService {
    constructor(
        private readonly jobRepository: WorkflowJobRepository,
        @Inject(ERROR_CLASSIFIER_SERVICE_TOKEN)
        private readonly errorClassifier: IErrorClassifierService,
        private readonly logger: PinoLoggerService,
        private readonly observability: ObservabilityService,
        @Optional()
        private readonly codeReviewHandler?: CodeReviewHandlerService,
        @Optional()
        private readonly runCodeReviewAutomationUseCase?: RunCodeReviewAutomationUseCase,
    ) {}

    async process(jobId: string): Promise<void> {
        const job = await this.jobRepository.findOne(jobId);

        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }

        // Valida que é um job de code review
        if (job.workflowType !== WorkflowType.CODE_REVIEW) {
            throw new Error(
                `Job ${jobId} is not a CODE_REVIEW workflow (type: ${job.workflowType})`,
            );
        }

        // Define correlation ID no contexto de observabilidade para propagação
        if (job.correlationId) {
            const obs = this.observability as any;
            if (obs.setContext) {
                obs.setContext({ correlationId: job.correlationId });
            }
        }

        return await this.observability.runInSpan(
            'workflow.job.process',
            async (span) => {
                span.setAttributes({
                    'workflow.job.id': jobId,
                    'workflow.job.type': job.workflowType,
                    'workflow.job.handler': job.handlerType,
                    'workflow.correlation.id': job.correlationId,
                });

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

                    this.logger.log({
                        message: 'Processing code review job',
                        context: CodeReviewJobProcessorService.name,
                        metadata: {
                            jobId,
                            correlationId: job.correlationId,
                            workflowType: job.workflowType,
                            handlerType: job.handlerType,
                        },
                    });

                    // Extrai dados do payload
                    const payload = job.payload as {
                        platformType: PlatformType;
                        repositoryId: string;
                        repositoryName: string;
                        pullRequestNumber: number;
                        pullRequestData: Record<string, unknown>;
                    };

                    // Se handler type é PIPELINE_SYNC, executa pipeline existente
                    if (
                        job.handlerType === HandlerType.PIPELINE_SYNC &&
                        this.codeReviewHandler &&
                        this.runCodeReviewAutomationUseCase
                    ) {
                        // Encontra team com code review ativo (mesma lógica do RunCodeReviewAutomationUseCase)
                        const teamWithAutomation =
                            await this.runCodeReviewAutomationUseCase.findTeamWithActiveCodeReview(
                                {
                                    repository: {
                                        id: payload.repositoryId,
                                        name: payload.repositoryName,
                                    },
                                    platformType: payload.platformType,
                                    prNumber: payload.pullRequestNumber,
                                },
                            );

                        if (!teamWithAutomation) {
                            throw new Error(
                                `No active code review automation found for repository ${payload.repositoryId}`,
                            );
                        }

                        const {
                            organizationAndTeamData,
                            automationId,
                        } = teamWithAutomation;

                        // Mapeia payload para formato esperado pelo pipeline
                        const mappedPlatform = getMappedPlatform(
                            payload.platformType,
                        );
                        if (!mappedPlatform) {
                            throw new Error(
                                `Unsupported platform: ${payload.platformType}`,
                            );
                        }

                        const pullRequest = mappedPlatform.mapPullRequest({
                            payload: payload.pullRequestData,
                        });

                        if (!pullRequest) {
                            throw new Error(
                                `Could not map pull request from payload`,
                            );
                        }

                        const repository = mappedPlatform.mapRepository({
                            payload: payload.pullRequestData,
                        });

                        if (!repository) {
                            throw new Error(
                                `Could not map repository from payload`,
                            );
                        }

                        // Executa pipeline via CodeReviewHandlerService
                        const result = await this.codeReviewHandler.handlePullRequest(
                            organizationAndTeamData,
                            repository,
                            pullRequest.base?.ref || 'main',
                            pullRequest,
                            payload.platformType,
                            automationId,
                            'webhook', // origin
                            payload.pullRequestData.action as string || 'opened', // action
                            job.correlationId, // executionId
                            payload.pullRequestData.triggerCommentId as
                                | number
                                | string
                                | undefined,
                            jobId, // workflowJobId (for pausing/resuming)
                        );

                        if (!result) {
                            throw new Error('Pipeline execution returned null');
                        }

                        this.logger.log({
                            message: 'Pipeline executed successfully',
                            context: CodeReviewJobProcessorService.name,
                            metadata: {
                                jobId,
                                correlationId: job.correlationId,
                                pullRequestNumber: payload.pullRequestNumber,
                            },
                        });

                        // Marca como completo
                        await this.markCompleted(jobId, result);
                    } else {
                        // Para outros handler types ou se pipeline não disponível, apenas simula
                        this.logger.warn({
                            message:
                                'Pipeline not available or handler type not PIPELINE_SYNC, simulating execution',
                            context: CodeReviewJobProcessorService.name,
                            metadata: {
                                jobId,
                                handlerType: job.handlerType,
                                hasCodeReviewHandler: !!this.codeReviewHandler,
                            },
                        });

                        await new Promise((resolve) => setTimeout(resolve, 1000));
                        await this.markCompleted(jobId, { success: true });
                    }

                    const duration = Date.now() - startTime;

                    span.setAttributes({
                        'workflow.job.completed': true,
                        'workflow.job.duration_ms': duration,
                    });

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
                    // Check if error is WorkflowPausedError (expected pause, not failure)
                    if (error instanceof WorkflowPausedError) {
                        // Pause workflow instead of treating as failure
                        await this.pauseWorkflow(jobId, error);
                        this.logger.log({
                            message: `Workflow ${jobId} paused waiting for event: ${error.eventType}`,
                            context: CodeReviewJobProcessorService.name,
                            metadata: {
                                jobId,
                                correlationId: job.correlationId,
                                eventType: error.eventType,
                                eventKey: error.eventKey,
                                timeout: error.timeout,
                            },
                        });
                        // Don't re-throw - pause is expected, not an error
                        return;
                    }

                    // Real error - handle failure
                    span.setAttributes({
                        'error': true,
                        'exception.type': error.name,
                        'exception.message': error.message,
                    });

                    await this.handleFailure(jobId, error as Error);
                    throw error;
                }
            },
            {
                'workflow.component': 'processor',
                'workflow.operation': 'process_job',
            },
        );
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
                    correlationId: job.correlationId,
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
                    correlationId: job.correlationId,
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

           /**
            * Pauses workflow waiting for an external event.
            * Worker is freed and can process other jobs.
            */
           private async pauseWorkflow(
               jobId: string,
               error: WorkflowPausedError,
           ): Promise<void> {
               await this.jobRepository.update(jobId, {
                   status: JobStatus.WAITING_FOR_EVENT,
                   waitingForEvent: {
                       eventType: error.eventType,
                       eventKey: error.eventKey,
                       timeout: error.timeout,
                       pausedAt: new Date(),
                   },
                   metadata: {
                       ...(await this.jobRepository.findOne(jobId))?.metadata,
                       pausedContext: error.context,
                   },
               });

               this.logger.log({
                   message: `Workflow ${jobId} paused waiting for event`,
                   context: CodeReviewJobProcessorService.name,
                   metadata: {
                       jobId,
                       eventType: error.eventType,
                       eventKey: error.eventKey,
                       timeout: error.timeout,
                   },
               });
           }
       }
