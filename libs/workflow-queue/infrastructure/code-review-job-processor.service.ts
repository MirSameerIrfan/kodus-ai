import { environment } from '@config/ee/environment/environment.dev';
import { Injectable, Inject } from '@nestjs/common';
import { MoreThanOrEqual } from 'typeorm';

import {
    AUTOMATION_EXECUTION_REPOSITORY_TOKEN,
    IAutomationExecutionRepository,
} from '@libs/automation/domain/contracts/automation-execution.repository';
import {
    AUTOMATION_EXECUTION_SERVICE_TOKEN,
    IAutomationExecutionService,
} from '@libs/automation/domain/contracts/automation-execution.service';
import { AutomationStatus } from '@libs/automation/domain/enums/automation-status';
import {
    CODE_REVIEW_EXECUTION_SERVICE,
    ICodeReviewExecutionService,
} from '@libs/code-review/domain/executions/contracts/codeReviewExecution.service.contract';
import { CodeReviewPipelineStrategyEE } from '@libs/code-review/ee/pipeline/strategies/code-review-pipeline.strategy.ee';
import { CodeReviewValidationService } from '@libs/code-review/infrastructure/code-review-validation.service';
import { PlatformType } from '@libs/core/domain/enums/platform-type.enum';
import { IJobProcessorService } from '@libs/workflow-queue/domain/contracts/job-processor.service.contract';
import { ErrorClassification } from '@libs/workflow-queue/domain/enums/error-classification.enum';
import { JobStatus } from '@libs/workflow-queue/domain/enums/job-status.enum';
import { WorkflowType } from '@libs/workflow-queue/domain/enums/workflow-type.enum';
import { ERROR_CLASSIFIER_SERVICE_TOKEN } from '@libs/workflow-queue/domain/contracts/error-classifier.service.contract';
import { IErrorClassifierService } from '@libs/workflow-queue/domain/contracts/error-classifier.service.contract';

import { CodeReviewPipelineExecutor } from '@libs/code-review/infrastructure/codeReviewPipeline/pipeline/pipeline-executor.service';
import { PipelineStateManager } from '@libs/code-review/infrastructure/codeReviewPipeline/pipeline/pipeline-state-manager.service';
import { CodeReviewPipelineStrategy } from '@libs/code-review/infrastructure/codeReviewPipeline/strategies/code-review-pipeline.strategy';
import { CodeReviewPipelineContext } from '@libs/code-review/infrastructure/codeReviewPipeline/context/code-review-pipeline.context';
import { WorkflowPausedError } from '@libs/workflow-queue/domain/errors/workflow-paused.error';
import { TaskStatus } from '@libs/code-review/ee/ast/codeASTAnalysis.service';
import { Repository } from '@libs/core/infrastructure/config/types/general/codeReview.type';

import { DistributedLockService } from './distributed-lock.service';
import { DEFAULT_RETRY_POLICY } from './retry-policy.config';
import { RetryPolicyService } from './retry-policy.service';

@Injectable()
export class CodeReviewJobProcessorService implements IJobProcessorService {
    constructor(
        private readonly jobRepository: WorkflowJobRepository,
        @Inject(ERROR_CLASSIFIER_SERVICE_TOKEN)
        private readonly errorClassifier: IErrorClassifierService,
        private readonly logger: PinoLoggerService,
        private readonly observability: ObservabilityService,
        private readonly validationService: CodeReviewValidationService,
        private readonly pipelineExecutor: CodeReviewPipelineExecutor,
        private readonly stateManager: PipelineStateManager,
        private readonly ceStrategy: CodeReviewPipelineStrategy,
        private readonly eeStrategy: CodeReviewPipelineStrategyEE,
        @Inject(AUTOMATION_EXECUTION_SERVICE_TOKEN)
        private readonly automationExecutionService: IAutomationExecutionService,
        @Inject(AUTOMATION_EXECUTION_REPOSITORY_TOKEN)
        private readonly automationExecutionRepository: IAutomationExecutionRepository,
        @Inject(CODE_REVIEW_EXECUTION_SERVICE)
        private readonly codeReviewExecutionService: ICodeReviewExecutionService,
        private readonly retryPolicyService: RetryPolicyService,
        private readonly distributedLockService: DistributedLockService,
    ) {}

    async process(jobId: string): Promise<void> {
        // ✅ Adquirir lock distribuído para garantir exactly-once processing
        const lock = await this.distributedLockService.acquire(`job:${jobId}`, {
            ttl: 300000, // 5 minutos (auto-release se worker crashar)
        });

        if (!lock) {
            // Job já está sendo processado por outro worker
            this.logger.warn({
                message: `Job ${jobId} already being processed by another worker`,
                context: CodeReviewJobProcessorService.name,
                metadata: { jobId },
            });
            return;
        }

        try {
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

            // Verificar se já foi processado (idempotência)
            if (job.status === JobStatus.COMPLETED) {
                this.logger.log({
                    message: `Job ${jobId} already completed, skipping`,
                    context: CodeReviewJobProcessorService.name,
                    metadata: { jobId },
                });
                return;
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
                                isResume: !!job.pipelineState,
                            },
                        });

                        // Check if this is a resume (job has pipelineState)
                        const isResume =
                            !!job.pipelineState &&
                            !!job.metadata?.stageCompletedEvent;

                        if (isResume) {
                            // Resume existing pipeline execution
                            await this.resumePipelineExecution(jobId, job);
                            return;
                        }

                        // Extrai dados do payload
                        const payload = job.payload as {
                            platformType: PlatformType;
                            repositoryId: string;
                            repositoryName: string;
                            pullRequestNumber: number;
                            pullRequestData: Record<string, unknown>;
                            organizationId?: string;
                            teamId?: string;
                        };

                        // Encontra team com code review ativo usando CodeReviewValidationService
                        const teamWithAutomation =
                            await this.validationService.findTeamWithActiveCodeReview(
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

                        const { organizationAndTeamData, automationId } =
                            teamWithAutomation;

                        // Check for active execution (deduplication)
                        const existingExecution = await this.getActiveExecution(
                            automationId,
                            payload.pullRequestNumber,
                            payload.repositoryId,
                        );

                        if (existingExecution) {
                            this.logger.warn({
                                message: `Code review already in progress for PR#${payload.pullRequestNumber}`,
                                context: CodeReviewJobProcessorService.name,
                                metadata: {
                                    existingExecutionId: existingExecution.uuid,
                                    jobId,
                                    correlationId: job.correlationId,
                                    pullRequestNumber:
                                        payload.pullRequestNumber,
                                },
                            });
                            // Mark job as completed (duplicate)
                            await this.markCompleted(jobId, {
                                duplicate: true,
                                existingExecutionId: existingExecution.uuid,
                            });
                            return;
                        }

                        // Create AutomationExecution using correlationId as uuid
                        const automationExecution =
                            await this.createAutomationExecution(
                                {
                                    organizationAndTeamData,
                                    pullRequest: {
                                        number: payload.pullRequestNumber,
                                    },
                                    repository: {
                                        id: payload.repositoryId,
                                        name: payload.repositoryName,
                                    },
                                    teamAutomationId: automationId,
                                    platformType: payload.platformType,
                                    origin: 'webhook',
                                },
                                AutomationStatus.IN_PROGRESS,
                                'Automation started',
                                job.correlationId, // Use correlationId as uuid
                            );

                        if (!automationExecution) {
                            throw new Error(
                                'Failed to create AutomationExecution',
                            );
                        }

                        // Synchronize AutomationExecution.status with WorkflowJob.status
                        await this.syncAutomationExecutionStatus(
                            automationExecution.uuid,
                            JobStatus.PROCESSING,
                        );

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

                        // Create initial pipeline context
                        const initialContext: CodeReviewPipelineContext = {
                            workflowJobId: jobId,
                            currentStage: undefined,
                            dryRun: {
                                enabled: false,
                            },
                            statusInfo: {
                                status: AutomationStatus.IN_PROGRESS,
                                message: 'Pipeline started',
                            },
                            pipelineVersion: '1.0.0',
                            errors: [],
                            organizationAndTeamData,
                            repository: {
                                platform:
                                    payload.platformType.toLowerCase() as any,
                                id: repository.id,
                                name: repository.name,
                                fullName: repository.fullName,
                                language: repository.language || '',
                                defaultBranch:
                                    pullRequest.base?.repo?.defaultBranch ||
                                    'main',
                            } as Repository,
                            branch: pullRequest.base?.ref || 'main',
                            pullRequest: {
                                number: pullRequest.number,
                                title: pullRequest.title || '',
                                base: {
                                    repo: {
                                        fullName:
                                            pullRequest.base?.repo?.fullName ||
                                            repository.fullName ||
                                            '',
                                    },
                                    ref: pullRequest.base?.ref || 'main',
                                },
                                repository: {
                                    platform:
                                        payload.platformType.toLowerCase() as any,
                                    id: repository.id,
                                    name: repository.name,
                                    fullName: repository.fullName,
                                    language: repository.language || '',
                                    defaultBranch:
                                        pullRequest.base?.repo?.defaultBranch ||
                                        'main',
                                } as Repository,
                                isDraft: pullRequest.isDraft || false,
                                tags: pullRequest.tags || [],
                                stats: {
                                    total_additions: 0,
                                    total_deletions: 0,
                                    total_files: 0,
                                    total_lines_changed: 0,
                                },
                                ...pullRequest,
                            },
                            teamAutomationId: automationId,
                            origin: 'webhook',
                            action:
                                (payload.pullRequestData.action as string) ||
                                'opened',
                            platformType: payload.platformType,
                            triggerCommentId: payload.pullRequestData
                                .triggerCommentId as
                                | number
                                | string
                                | undefined,
                            pipelineMetadata: {
                                lastExecution: automationExecution as any,
                            },
                            batches: [],
                            preparedFileContexts: [],
                            validSuggestions: [],
                            discardedSuggestions: [],
                            lastAnalyzedCommit: null,
                            validSuggestionsByPR: [],
                            validCrossFileSuggestions: [],
                            tasks: {
                                astAnalysis: {
                                    taskId: '',
                                    status: TaskStatus.TASK_STATUS_UNSPECIFIED,
                                },
                            },
                            correlationId: job.correlationId,
                        };

                        // Get pipeline strategy (CE or EE)
                        const isCloud = environment.API_CLOUD_MODE;
                        const strategy = isCloud
                            ? this.eeStrategy
                            : this.ceStrategy;
                        const stages = strategy.configureStages() as any[];

                        // Execute pipeline via PipelineExecutor with retry policy
                        // Note: WorkflowPausedError is not retryable (expected pause)
                        const result =
                            await this.retryPolicyService.executeWithRetry(
                                () =>
                                    this.pipelineExecutor.execute(
                                        initialContext,
                                        stages,
                                        jobId,
                                    ),
                                {
                                    ...DEFAULT_RETRY_POLICY,
                                    retryableErrors: (error: Error) => {
                                        // Don't retry WorkflowPausedError (expected pause)
                                        if (
                                            error instanceof WorkflowPausedError
                                        ) {
                                            return false;
                                        }
                                        // Use default retryable errors check
                                        return (
                                            DEFAULT_RETRY_POLICY.retryableErrors?.(
                                                error,
                                            ) || false
                                        );
                                    },
                                },
                            );

                        // Synchronize AutomationExecution.status with WorkflowJob.status (SUCCESS)
                        await this.syncAutomationExecutionStatus(
                            automationExecution.uuid,
                            JobStatus.COMPLETED,
                        );

                        this.logger.log({
                            message: 'Pipeline executed successfully',
                            context: CodeReviewJobProcessorService.name,
                            metadata: {
                                jobId,
                                correlationId: job.correlationId,
                                pullRequestNumber: payload.pullRequestNumber,
                                automationExecutionId: automationExecution.uuid,
                            },
                        });

                        // Mark job as completed
                        await this.markCompleted(jobId, result);

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
                            // Synchronize AutomationExecution.status (IN_PROGRESS when paused)
                            const jobAfterPause =
                                await this.jobRepository.findOne(jobId);
                            if (
                                jobAfterPause?.metadata?.automationExecutionId
                            ) {
                                await this.syncAutomationExecutionStatus(
                                    jobAfterPause.metadata
                                        .automationExecutionId as string,
                                    JobStatus.WAITING_FOR_EVENT,
                                );
                            }

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

                        // Synchronize AutomationExecution.status (ERROR on failure)
                        const jobAfterError =
                            await this.jobRepository.findOne(jobId);
                        if (jobAfterError?.metadata?.automationExecutionId) {
                            await this.syncAutomationExecutionStatus(
                                jobAfterError.metadata
                                    .automationExecutionId as string,
                                JobStatus.FAILED,
                            );
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
        } finally {
            // ✅ Liberar lock distribuído
            await lock.release();
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
        const job = await this.jobRepository.findOne(jobId);
        if (!job) {
            return;
        }

        const duration = job.startedAt
            ? Date.now() - job.startedAt.getTime()
            : 0;

        await this.jobRepository.addExecutionHistory(jobId, {
            attemptNumber: job.retryCount,
            status: JobStatus.COMPLETED,
            startedAt: job.startedAt || new Date(),
            completedAt: new Date(),
            durationMs: duration,
        });

        await this.jobRepository.update(jobId, {
            status: JobStatus.COMPLETED,
            completedAt: new Date(),
        });

        // Synchronize AutomationExecution.status (SUCCESS)
        if (job.metadata?.automationExecutionId) {
            await this.syncAutomationExecutionStatus(
                job.metadata.automationExecutionId as string,
                JobStatus.COMPLETED,
            );
        }
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
        const job = await this.jobRepository.findOne(jobId);
        await this.jobRepository.update(jobId, {
            status: JobStatus.WAITING_FOR_EVENT,
            waitingForEvent: {
                eventType: error.eventType,
                eventKey: error.eventKey,
                timeout: error.timeout,
                pausedAt: new Date(),
            },
            metadata: {
                ...job?.metadata,
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

    /**
     * Resume pipeline execution from saved state
     */
    private async resumePipelineExecution(
        jobId: string,
        job: any,
    ): Promise<void> {
        this.logger.log({
            message: `Resuming pipeline execution for job ${jobId}`,
            context: CodeReviewJobProcessorService.name,
            metadata: {
                jobId,
                correlationId: job.correlationId,
                currentStage: job.pipelineState?.currentStage,
            },
        });

        // Load pipeline state
        const context = await this.stateManager.resumeFromState(jobId);
        if (!context) {
            throw new Error(
                `Cannot resume pipeline: no saved state found for job ${jobId}`,
            );
        }

        // Get stage completed event from metadata
        const stageCompletedEvent = job.metadata?.stageCompletedEvent;
        if (!stageCompletedEvent || !stageCompletedEvent.taskId) {
            throw new Error(
                `Cannot resume pipeline: missing stageCompletedEvent or taskId in job metadata`,
            );
        }

        // Get pipeline strategy (CE or EE)
        const isCloud = environment.API_CLOUD_MODE;
        const strategy = isCloud ? this.eeStrategy : this.ceStrategy;
        const stages = strategy.configureStages() as any[];

        // Resume pipeline execution
        const result = await this.pipelineExecutor.resume(
            context,
            stages,
            stageCompletedEvent.taskId,
            jobId,
        );

        // Synchronize AutomationExecution.status with WorkflowJob.status (SUCCESS)
        if (job.metadata?.automationExecutionId) {
            await this.syncAutomationExecutionStatus(
                job.metadata.automationExecutionId as string,
                JobStatus.COMPLETED,
            );
        }

        this.logger.log({
            message: 'Pipeline resumed and executed successfully',
            context: CodeReviewJobProcessorService.name,
            metadata: {
                jobId,
                correlationId: job.correlationId,
                resumedStage: stageCompletedEvent.stageName,
            },
        });

        // Mark job as completed
        await this.markCompleted(jobId, result);
    }

    /**
     * Check for active AutomationExecution (deduplication)
     */
    private async getActiveExecution(
        teamAutomationId: string,
        pullRequestNumber: number,
        repositoryId: string,
    ) {
        try {
            const cutoffTime = new Date();
            cutoffTime.setMinutes(cutoffTime.getMinutes() - 30);

            const activeExecutions = await this.automationExecutionService.find(
                {
                    teamAutomation: { uuid: teamAutomationId },
                    pullRequestNumber: pullRequestNumber,
                    repositoryId: repositoryId,
                    status: AutomationStatus.IN_PROGRESS,
                    createdAt: MoreThanOrEqual(cutoffTime) as any,
                } as any,
            );

            return activeExecutions?.[0] || null;
        } catch (error) {
            this.logger.error({
                message: 'Error checking for active execution',
                context: CodeReviewJobProcessorService.name,
                error: error instanceof Error ? error : undefined,
                metadata: {
                    teamAutomationId,
                    pullRequestNumber,
                    repositoryId,
                },
            });
            return null;
        }
    }

    /**
     * Create AutomationExecution using correlationId as uuid
     */
    private async createAutomationExecution(
        payload: {
            organizationAndTeamData: any;
            pullRequest: { number: number };
            repository: { id: string; name: string };
            teamAutomationId: string;
            platformType: PlatformType;
            origin: string;
        },
        status: AutomationStatus,
        message: string,
        uuid: string, // correlationId used as uuid
    ) {
        try {
            // Create AutomationExecution with specific uuid (correlationId)
            const automationExecution =
                await this.automationExecutionRepository.create(
                    {
                        uuid, // Use correlationId as uuid
                        status,
                        dataExecution: {
                            platformType: payload.platformType,
                            organizationAndTeamData:
                                payload.organizationAndTeamData,
                            pullRequestNumber: payload.pullRequest.number,
                            repositoryId: payload.repository.id,
                        },
                        teamAutomation: { uuid: payload.teamAutomationId },
                        origin: payload.origin || 'System',
                        pullRequestNumber: payload.pullRequest.number,
                        repositoryId: payload.repository.id,
                    } as any, // Type assertion needed because repository.create accepts IAutomationExecution with uuid
                );

            if (!automationExecution) {
                this.logger.warn({
                    message:
                        'Failed to create automation execution before creating code review',
                    context: CodeReviewJobProcessorService.name,
                    metadata: { uuid, status },
                });
                return null;
            }

            // Create CodeReviewExecution
            await this.codeReviewExecutionService.create({
                automationExecution: {
                    uuid: automationExecution.uuid,
                },
                status,
                message,
            });

            return automationExecution;
        } catch (error) {
            // Check for unique constraint violation (PostgreSQL error code 23505)
            const isDuplicateError =
                (error as any)?.code === '23505' ||
                (error as any)?.constraint?.includes('unique') ||
                (error as any)?.message?.includes('duplicate');

            if (isDuplicateError) {
                this.logger.warn({
                    message:
                        'Duplicate execution detected - another process is already handling this PR',
                    context: CodeReviewJobProcessorService.name,
                    metadata: {
                        teamAutomationId: payload.teamAutomationId,
                        pullRequestNumber: payload.pullRequest.number,
                        repositoryId: payload.repository.id,
                        uuid,
                    },
                });
                return null;
            }

            this.logger.error({
                message: 'Error creating automation execution',
                context: CodeReviewJobProcessorService.name,
                error: error instanceof Error ? error : undefined,
                metadata: {
                    teamAutomationId: payload.teamAutomationId,
                    status,
                    uuid,
                },
            });
            throw error;
        }
    }

    /**
     * Synchronize AutomationExecution.status with WorkflowJob.status
     */
    private async syncAutomationExecutionStatus(
        automationExecutionId: string,
        jobStatus: JobStatus,
    ): Promise<void> {
        let automationStatus: AutomationStatus;

        switch (jobStatus) {
            case JobStatus.PROCESSING:
                automationStatus = AutomationStatus.IN_PROGRESS;
                break;
            case JobStatus.COMPLETED:
                automationStatus = AutomationStatus.SUCCESS;
                break;
            case JobStatus.FAILED:
                automationStatus = AutomationStatus.ERROR;
                break;
            case JobStatus.WAITING_FOR_EVENT:
                automationStatus = AutomationStatus.IN_PROGRESS; // Still in progress when paused
                break;
            default:
                // Don't update for other statuses
                return;
        }

        try {
            await this.automationExecutionService.update(
                { uuid: automationExecutionId },
                { status: automationStatus } as any,
            );

            this.logger.debug({
                message: `Synchronized AutomationExecution status`,
                context: CodeReviewJobProcessorService.name,
                metadata: {
                    automationExecutionId,
                    jobStatus,
                    automationStatus,
                },
            });
        } catch (error) {
            this.logger.error({
                message: `Failed to synchronize AutomationExecution status`,
                context: CodeReviewJobProcessorService.name,
                error: error instanceof Error ? error : undefined,
                metadata: {
                    automationExecutionId,
                    jobStatus,
                },
            });
            // Don't throw - status sync failure shouldn't break workflow
        }
    }
}
