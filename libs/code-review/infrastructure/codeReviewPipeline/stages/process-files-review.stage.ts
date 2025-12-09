import { createLogger } from '@kodus/flow';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import pLimit from 'p-limit';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

import { BaseStage } from './base/base-stage.abstract';
import { HeavyStage } from './base/heavy-stage.interface';
import { EventType } from '@libs/workflow-queue/domain/enums/event-type.enum';
import { StageCompletedEvent } from '@libs/workflow-queue/domain/interfaces/stage-completed-event.interface';
import { WorkflowPausedError } from '@libs/workflow-queue/domain/errors/workflow-paused.error';
import {
    AIAnalysisResult,
    AnalysisContext,
    CodeReviewVersion,
    CodeReviewConfig,
    CodeSuggestion,
    FileChange,
    IFinalAnalysisResult,
} from '@libs/core/domain/types/general/codeReview.type';
import { benchmark } from '@libs/core/utils/benchmark.util';
import { createOptimizedBatches } from '@libs/core/utils/batch.helper';
import { OrganizationAndTeamData } from '@libs/core/domain/types/general/organizationAndTeamData';

import {
    IPullRequestsService,
    PULL_REQUESTS_SERVICE_TOKEN,
} from '@libs/code-review/domain/pull-requests/contracts/pullRequests.service.contracts';
import {
    ISuggestionService,
    SUGGESTION_SERVICE_TOKEN,
} from '@libs/code-review/domain/contracts/SuggestionService.contract';
import {
    FILE_REVIEW_CONTEXT_PREPARATION_TOKEN,
    IFileReviewContextPreparation,
} from '@libs/core/domain/interfaces/file-review-context-preparation.interface';
import { DeliveryStatus } from '@libs/code-review/domain/pull-requests/enums/deliveryStatus.enum';
import { ImplementationStatus } from '@libs/code-review/domain/pull-requests/enums/implementationStatus.enum';
import { PriorityStatus } from '@libs/code-review/domain/pull-requests/enums/priorityStatus.enum';
import {
    CodeReviewPipelineContext,
    FileContextAgentResult,
} from '../context/code-review-pipeline.context';
import {
    IKodyFineTuningContextPreparationService,
    KODY_FINE_TUNING_CONTEXT_PREPARATION_TOKEN,
} from '@libs/core/domain/interfaces/kody-fine-tuning-context-preparation.interface';
import {
    IKodyASTAnalyzeContextPreparationService,
    KODY_AST_ANALYZE_CONTEXT_PREPARATION_TOKEN,
} from '@libs/core/domain/interfaces/kody-ast-analyze-context-preparation.interface';
import { CodeAnalysisOrchestrator } from '@libs/code-review/ee/analysis/codeAnalysisOrchestrator.service';
import { TaskStatus } from '@libs/code-review/ee/ast/codeASTAnalysis.service';

@Injectable()
export class ProcessFilesReview extends BaseStage implements HeavyStage {
    private readonly logger = createLogger(ProcessFilesReview.name);
    readonly name = 'FileAnalysisStage';
    readonly dependsOn: string[] = ['PRLevelReviewStage']; // Depends on PRLevelReviewStage

    // HeavyStage properties
    readonly timeout = 15 * 60 * 1000; // 15 minutes
    readonly eventType = EventType.FILES_REVIEW_COMPLETED;

    private readonly concurrencyLimit = 20;

    // Store results temporarily (in production, this would be in a database/cache)
    private readonly resultsCache = new Map<
        string,
        CodeReviewPipelineContext
    >();

    constructor(
        @Inject(SUGGESTION_SERVICE_TOKEN)
        private readonly suggestionService: ISuggestionService,
        @Inject(PULL_REQUESTS_SERVICE_TOKEN)
        private readonly pullRequestService: IPullRequestsService,
        @Inject(FILE_REVIEW_CONTEXT_PREPARATION_TOKEN)
        private readonly fileReviewContextPreparation: IFileReviewContextPreparation,
        @Inject(KODY_FINE_TUNING_CONTEXT_PREPARATION_TOKEN)
        private readonly kodyFineTuningContextPreparation: IKodyFineTuningContextPreparationService,
        @Inject(KODY_AST_ANALYZE_CONTEXT_PREPARATION_TOKEN)
        private readonly kodyAstAnalyzeContextPreparation: IKodyASTAnalyzeContextPreparationService,
        private readonly codeAnalysisOrchestrator: CodeAnalysisOrchestrator,
        @Optional()
        private readonly amqpConnection?: AmqpConnection,
    ) {
        super();
    }

    /**
     * Check if this is a light stage
     * Returns false - this is a heavy stage
     */
    isLight(): boolean {
        return false;
    }

    /**
     * Start the heavy stage execution
     * For now, executes synchronously but returns taskId for future async implementation
     */
    async start(context: CodeReviewPipelineContext): Promise<string> {
        const taskId = uuidv4();

        this.logger.log({
            message: `Starting file review for PR#${context.pullRequest.number}`,
            context: this.name,
            metadata: {
                taskId,
                prNumber: context.pullRequest.number,
                filesCount: context.changedFiles?.length || 0,
                correlationId: context.correlationId,
            },
        });

        if (!context.changedFiles || context.changedFiles.length === 0) {
            this.logger.warn({
                message: `No files to analyze for PR#${context.pullRequest.number}`,
                context: this.name,
            });
            // Store empty result
            this.resultsCache.set(taskId, context);
            await this.publishCompletionEvent(taskId, context, context);
            return taskId;
        }

        try {
            // TODO: In future, this should enqueue the analysis and return immediately
            // For now, execute synchronously but store result for getResult/resume
            const result = await this.executeAnalysis(context);

            // Store result temporarily
            this.resultsCache.set(taskId, result);

            // Publish completion event (simulating async completion)
            await this.publishCompletionEvent(taskId, result, context);

            return taskId;
        } catch (error) {
            this.logger.error({
                message: 'Error analyzing files in batches',
                error,
                context: this.name,
                metadata: {
                    pullRequestNumber: context.pullRequest.number,
                    repositoryName: context.repository.name,
                    batchCount: context.batches?.length || 0,
                },
            });

            // Store error result (empty suggestions)
            const errorResult = this.updateContext(context, (draft) => {
                draft.validSuggestions = [];
                draft.discardedSuggestions = [];
                draft.fileMetadata = new Map();
            });
            this.resultsCache.set(taskId, errorResult);
            await this.publishCompletionEvent(taskId, errorResult, context);
            return taskId;
        }
    }

    /**
     * Get result of heavy stage execution
     * Retrieves the completed result from cache/storage
     */
    async getResult(
        context: CodeReviewPipelineContext,
        taskId: string,
    ): Promise<CodeReviewPipelineContext> {
        const result = this.resultsCache.get(taskId);
        if (!result) {
            throw new Error(`No result found for taskId: ${taskId}`);
        }

        // Remove from cache after retrieval
        this.resultsCache.delete(taskId);

        return result;
    }

    /**
     * Resume heavy stage execution after pause
     * Since analysis was already done in start(), just return the context
     */
    async resume(
        context: CodeReviewPipelineContext,
        taskId: string,
    ): Promise<CodeReviewPipelineContext> {
        // Result was already applied in getResult(), just return context
        return context;
    }

    /**
     * Execute method - calls start() and throws WorkflowPausedError
     */
    async execute(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        // Start heavy stage and get taskId
        const taskId = await this.start(context);

        // Throw WorkflowPausedError to pause workflow
        // Worker will be freed and workflow will resume when event arrives
        throw new WorkflowPausedError(
            this.eventType,
            taskId, // eventKey is the taskId
            this.name,
            taskId,
            this.timeout,
            {
                workflowJobId: context.workflowJobId,
                correlationId: context.correlationId,
            },
        );
    }

    /**
     * Execute the actual analysis (extracted from original executeStage)
     * TODO: This should be moved to an async service that publishes events when done
     */
    private async executeAnalysis(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        const { validSuggestions, discardedSuggestions, fileMetadata, tasks } =
            await this.analyzeChangedFilesInBatches(context);

        return this.updateContext(context, (draft) => {
            draft.validSuggestions = validSuggestions;
            draft.discardedSuggestions = discardedSuggestions;
            draft.fileMetadata = fileMetadata;
            draft.tasks = tasks;
        });
    }

    /**
     * Publish completion event to RabbitMQ
     */
    private async publishCompletionEvent(
        taskId: string,
        result: CodeReviewPipelineContext,
        context: CodeReviewPipelineContext,
    ): Promise<void> {
        if (!this.amqpConnection) {
            this.logger.debug({
                message:
                    'RabbitMQ not available, skipping files review completion event',
                context: this.name,
                metadata: { taskId },
            });
            return;
        }

        try {
            const event: StageCompletedEvent = {
                stageName: this.name,
                eventType: this.eventType,
                eventKey: taskId,
                taskId,
                result: {
                    validSuggestions: result.validSuggestions || [],
                    discardedSuggestions: result.discardedSuggestions || [],
                    fileMetadata: result.fileMetadata
                        ? Array.from(result.fileMetadata.entries())
                        : [],
                    tasks: result.tasks,
                },
                metadata: {
                    workflowJobId: context.workflowJobId,
                    correlationId: context.correlationId,
                    prNumber: context.pullRequest.number,
                    filesCount: context.changedFiles?.length || 0,
                },
            };

            await this.amqpConnection.publish(
                'workflow.events',
                `stage.completed.${this.eventType}`,
                event,
                {
                    messageId: `files-review-${taskId}`,
                    correlationId: context.correlationId,
                    persistent: true,
                    headers: {
                        'x-event-type': this.eventType,
                        'x-task-id': taskId,
                        'x-stage-name': this.name,
                        'x-correlation-id': context.correlationId || '',
                    },
                },
            );

            this.logger.log({
                message: `Files review completion event published for task ${taskId}`,
                context: this.name,
                metadata: { taskId, prNumber: context.pullRequest.number },
            });
        } catch (error) {
            this.logger.error({
                message: `Failed to publish files review completion event for task ${taskId}`,
                context: this.name,
                error,
                metadata: { taskId },
            });
            // Don't throw - event publishing failure shouldn't break stage execution
        }
    }

    async analyzeChangedFilesInBatches(
        context: CodeReviewPipelineContext,
    ): Promise<{
        validSuggestions: Partial<CodeSuggestion>[];
        discardedSuggestions: Partial<CodeSuggestion>[];
        fileMetadata: Map<string, any>;
        validCrossFileSuggestions: CodeSuggestion[];
        tasks: AnalysisContext['tasks'];
    }> {
        const { organizationAndTeamData, pullRequest, changedFiles } = context;
        const analysisContext =
            this.createAnalysisContextFromPipelineContext(context);

        const label = `Total review pipeline for PR#${pullRequest.number}`;

        return benchmark(
            { label, metadata: context.organizationAndTeamData },
            this.logger,
            async () => {
                try {
                    this.logger.log({
                        message: `Starting batch analysis of ${changedFiles.length} files`,
                        context: this.name,
                        metadata: {
                            organizationId:
                                organizationAndTeamData.organizationId,
                            teamId: organizationAndTeamData.teamId,
                            pullRequestNumber: pullRequest.number,
                        },
                    });

                    const batches = this.createOptimizedBatches(changedFiles);

                    // Criar um novo Map para esta execução
                    const fileMetadata = new Map<string, any>();

                    const execution = await this.runBatches(
                        batches,
                        analysisContext,
                        fileMetadata,
                        context.prAnalysisResults?.validCrossFileSuggestions,
                    );

                    this.logger.log({
                        message: `Finished all batches - Analysis complete for PR#${pullRequest.number}`,
                        context: this.name,
                        metadata: {
                            validSuggestionsCount:
                                execution.validSuggestions.length,
                            discardedCount:
                                execution.discardedSuggestions.length,
                            tasks: execution.tasks,
                            organizationAndTeamData: organizationAndTeamData,
                        },
                    });

                    // Retornar apenas os dados analisados sem criar comentários
                    return {
                        validSuggestions: execution.validSuggestions,
                        discardedSuggestions: execution.discardedSuggestions,
                        fileMetadata: fileMetadata,
                        validCrossFileSuggestions:
                            execution.validCrossFileSuggestions,
                        tasks: execution.tasks,
                    };
                } catch (error) {
                    this.logProcessingError(
                        error,
                        organizationAndTeamData,
                        pullRequest,
                    );
                    return {
                        validSuggestions: [],
                        discardedSuggestions: [],
                        fileMetadata: new Map(),
                        validCrossFileSuggestions: [],
                        tasks: { ...context.tasks },
                    };
                }
            },
        );
    }

    /**
     * Logs processing errors
     * @param error The error that occurred
     * @param organizationAndTeamData Organization and team data
     * @param pullRequest Pull request data
     */
    private logProcessingError(
        error: any,
        organizationAndTeamData: OrganizationAndTeamData,
        pullRequest: { number: number },
    ): void {
        this.logger.error({
            message: `Error in batch file processing`,
            error,
            context: ProcessFilesReview.name,
            metadata: {
                organizationId: organizationAndTeamData.organizationId,
                teamId: organizationAndTeamData.teamId,
                pullRequestNumber: pullRequest.number,
            },
        });
    }

    private async runBatches(
        batches: FileChange[][],
        context: AnalysisContext,
        fileMetadata: Map<string, any>,
        validCrossFileSuggestions: CodeSuggestion[],
    ): Promise<{
        validSuggestions: Partial<CodeSuggestion>[];
        discardedSuggestions: Partial<CodeSuggestion>[];
        validCrossFileSuggestions: CodeSuggestion[];
        tasks: AnalysisContext['tasks'];
    }> {
        const validSuggestions: Partial<CodeSuggestion>[] = [];
        const discardedSuggestions: Partial<CodeSuggestion>[] = [];
        const tasks: AnalysisContext['tasks'] = {
            astAnalysis: {
                ...context.tasks.astAnalysis,
            },
        };

        await this.processBatchesSequentially(
            batches,
            context,
            validSuggestions,
            discardedSuggestions,
            fileMetadata,
            validCrossFileSuggestions,
            tasks,
        );

        return {
            validSuggestions,
            discardedSuggestions,
            validCrossFileSuggestions,
            tasks,
        };
    }

    /**
     * Creates optimized batches of files for parallel processing
     * @param files Array of files to be processed
     * @returns Array of file batches
     */
    private createOptimizedBatches(files: FileChange[]): FileChange[][] {
        const batches = createOptimizedBatches(files, {
            minBatchSize: 20,
            maxBatchSize: 30,
        });

        this.validateBatchIntegrity(batches, files.length);

        this.logger.log({
            message: `Processing ${files.length} files in ${batches.length} batches`,
            context: ProcessFilesReview.name,
        });

        return batches;
    }

    /**
     * Validates the integrity of the batches to ensure all files are processed
     * @param batches Batches created for processing
     * @param totalFileCount Original total number of files
     */
    private validateBatchIntegrity(
        batches: FileChange[][],
        totalFileCount: number,
    ): void {
        const totalFilesInBatches = batches.reduce(
            (sum, batch) => sum + batch.length,
            0,
        );
        if (totalFilesInBatches !== totalFileCount) {
            this.logger.warn({
                message: `Potential file processing mismatch! Total files: ${totalFileCount}, files in batches: ${totalFilesInBatches}`,
                context: ProcessFilesReview.name,
            });
            // Ensure all files are processed even in case of mismatch
            if (totalFilesInBatches < totalFileCount) {
                // If we identify that files might be missing, process all at once
                batches.length = 0;
                batches.push(Array.from({ length: totalFileCount }));
            }
        }
    }

    private async processBatchesSequentially(
        batches: FileChange[][],
        context: AnalysisContext,
        validSuggestionsToAnalyze: Partial<CodeSuggestion>[],
        discardedSuggestionsBySafeGuard: Partial<CodeSuggestion>[],
        fileMetadata: Map<string, any>,
        validCrossFileSuggestions: CodeSuggestion[],
        tasks: AnalysisContext['tasks'],
    ): Promise<void> {
        for (const [index, batch] of batches.entries()) {
            this.logger.log({
                message: `Processing batch ${index + 1}/${batches.length} with ${batch.length} files`,
                context: ProcessFilesReview.name,
            });

            try {
                await this.processSingleBatch(
                    batch,
                    context,
                    validSuggestionsToAnalyze,
                    discardedSuggestionsBySafeGuard,
                    index,
                    fileMetadata,
                    tasks,
                );
            } catch (error) {
                this.logger.error({
                    message: `Error processing batch ${index + 1}`,
                    error,
                    context: ProcessFilesReview.name,
                    metadata: {
                        batchIndex: index,
                        batchSize: batch.length,
                        pullRequestNumber: context.pullRequest.number,
                    },
                });
                // Continuamos processando os próximos lotes mesmo se um falhar
            }
        }
    }

    private async processSingleBatch(
        batch: FileChange[],
        context: AnalysisContext,
        validSuggestions: Partial<CodeSuggestion>[],
        discardedSuggestions: Partial<CodeSuggestion>[],
        batchIndex: number,
        fileMetadata: Map<string, any>,
        tasks: AnalysisContext['tasks'],
    ): Promise<void> {
        const { organizationAndTeamData, pullRequest } = context;
        const label = `processSingleBatch → Batch #${batchIndex + 1} (${batch.length} arquivos)`;

        await benchmark(
            { label, metadata: context.organizationAndTeamData },
            this.logger,
            async () => {
                // TESTAR
                const preparedFiles = await this.filterAndPrepareFiles(
                    batch,
                    context,
                );

                const astFailed = preparedFiles.find((file) => {
                    const task = file.fileContext.tasks?.astAnalysis;
                    return (
                        task && task.status !== TaskStatus.TASK_STATUS_COMPLETED
                    );
                });

                if (astFailed) {
                    tasks.astAnalysis.status =
                        astFailed?.fileContext?.tasks?.astAnalysis?.status ||
                        TaskStatus.TASK_STATUS_FAILED;
                }

                const results = await Promise.allSettled(
                    preparedFiles.map(({ fileContext }) =>
                        this.executeFileAnalysis(fileContext),
                    ),
                );

                results.forEach((result) => {
                    if (result.status === 'fulfilled') {
                        this.collectFileProcessingResult(
                            result.value,
                            validSuggestions,
                            discardedSuggestions,
                            fileMetadata,
                        );
                    } else {
                        this.logger.error({
                            message: `Error processing file in batch ${batchIndex + 1}`,
                            error: result.reason,
                            context: this.name,
                            metadata: {
                                organizationId:
                                    organizationAndTeamData.organizationId,
                                teamId: organizationAndTeamData.teamId,
                                pullRequestNumber: pullRequest.number,
                                batchIndex,
                            },
                        });
                    }
                });
            },
        );
    }

    /**
     * Collects and organizes the results of file processing
     * @param fileProcessingResult Result of the file processing
     * @param validSuggestionsToAnalyze Array to store the valid suggestions found
     * @param discardedSuggestionsBySafeGuard Array to store the discarded suggestions
     * @param fileMetadata Map to store file metadata
     */
    private collectFileProcessingResult(
        fileProcessingResult: IFinalAnalysisResult & { file: FileChange },
        validSuggestionsToAnalyze: Partial<CodeSuggestion>[],
        discardedSuggestionsBySafeGuard: Partial<CodeSuggestion>[],
        fileMetadata: Map<string, any>,
    ): void {
        const file = fileProcessingResult.file;

        if (fileProcessingResult?.validSuggestionsToAnalyze?.length > 0) {
            validSuggestionsToAnalyze.push(
                ...fileProcessingResult.validSuggestionsToAnalyze,
            );
        }

        if (fileProcessingResult?.discardedSuggestionsBySafeGuard?.length > 0) {
            discardedSuggestionsBySafeGuard.push(
                ...fileProcessingResult.discardedSuggestionsBySafeGuard,
            );
        }

        if (fileProcessingResult?.file?.filename) {
            fileMetadata.set(fileProcessingResult.file.filename, {
                reviewMode: fileProcessingResult.reviewMode,
                codeReviewModelUsed: fileProcessingResult.codeReviewModelUsed,
            });
        }
    }

    private async filterAndPrepareFiles(
        batch: FileChange[],
        context: AnalysisContext,
    ): Promise<Array<{ fileContext: AnalysisContext }>> {
        const limit = pLimit(this.concurrencyLimit);

        const settledResults = await Promise.allSettled(
            batch.map((file) =>
                limit(() => {
                    const perFileContext: AnalysisContext = {
                        ...context,
                        fileAugmentations:
                            context.augmentationsByFile?.[file.filename] ?? {},
                    };

                    return this.fileReviewContextPreparation.prepareFileContext(
                        file,
                        perFileContext,
                    );
                }),
            ),
        );

        settledResults?.forEach((res, index) => {
            if (res.status === 'rejected') {
                this.logger.error({
                    message: `Error preparing the file "${batch[index]?.filename}" for analysis`,
                    error: res.reason,
                    context: ProcessFilesReview.name,
                    metadata: {
                        ...context.organizationAndTeamData,
                        pullRequestNumber: context.pullRequest.number,
                    },
                });
            }
        });

        return settledResults
            ?.filter(
                (
                    res,
                ): res is PromiseFulfilledResult<{
                    fileContext: AnalysisContext;
                }> => res.status === 'fulfilled' && res.value !== null,
            )
            ?.map((res) => res.value);
    }

    private async executeFileAnalysis(
        baseContext: AnalysisContext,
    ): Promise<IFinalAnalysisResult & { file: FileChange }> {
        const { reviewModeResponse } = baseContext;
        const { file, relevantContent, patchWithLinesStr, hasRelevantContent } =
            baseContext.fileChangeContext;

        try {
            const context: AnalysisContext = {
                ...baseContext,
                reviewModeResponse: reviewModeResponse,
                fileChangeContext: {
                    file,
                    relevantContent,
                    patchWithLinesStr,
                    hasRelevantContent,
                },
            };

            const standardAnalysisResult =
                await this.codeAnalysisOrchestrator.executeStandardAnalysis(
                    context.organizationAndTeamData,
                    context.pullRequest.number,
                    {
                        file,
                        relevantContent,
                        patchWithLinesStr,
                        hasRelevantContent,
                    },
                    reviewModeResponse,
                    context,
                );

            const finalResult = await this.processAnalysisResult(
                standardAnalysisResult,
                context,
            );

            return { ...finalResult, file };
        } catch (error) {
            this.logger.error({
                message: `Error analyzing file ${file.filename}`,
                error,
                context: ProcessFilesReview.name,
                metadata: {
                    filename: file.filename,
                    organizationId:
                        baseContext.organizationAndTeamData.organizationId,
                    teamId: baseContext.organizationAndTeamData.teamId,
                    pullRequestNumber: baseContext.pullRequest.number,
                },
            });

            return {
                validSuggestionsToAnalyze: [],
                discardedSuggestionsBySafeGuard: [],
                file,
            };
        }
    }

    private async processAnalysisResult(
        result: AIAnalysisResult,
        context: AnalysisContext,
    ): Promise<IFinalAnalysisResult> {
        const { reviewModeResponse } = context;
        const { file, relevantContent, patchWithLinesStr } =
            context.fileChangeContext;

        const validSuggestionsToAnalyze: Partial<CodeSuggestion>[] = [];
        const discardedSuggestionsBySafeGuard: Partial<CodeSuggestion>[] = [];
        let safeguardLLMProvider = '';

        const crossFileAnalysisSuggestions =
            context?.validCrossFileSuggestions || [];

        const validCrossFileSuggestions = crossFileAnalysisSuggestions?.filter(
            (suggestion) => suggestion.relevantFile === file.filename,
        );

        const initialFilterResult = await this.initialFilterSuggestions(
            result,
            context,
            validCrossFileSuggestions,
            patchWithLinesStr,
        );

        const kodyFineTuningResult = await this.applyKodyFineTuningFilter(
            initialFilterResult.filteredSuggestions,
            context,
        );

        const discardedSuggestionsByCodeDiff =
            initialFilterResult.discardedSuggestionsByCodeDiff;
        const discardedSuggestionsByKodyFineTuning =
            kodyFineTuningResult.discardedSuggestionsByKodyFineTuning;
        const keepedSuggestions = kodyFineTuningResult.keepedSuggestions;

        // Separar sugestões cross-file das demais
        const crossFileIds = new Set(
            validCrossFileSuggestions?.map((suggestion) => suggestion.id),
        );

        const filteredCrossFileSuggestions = keepedSuggestions.filter(
            (suggestion) => crossFileIds?.has(suggestion.id),
        );

        const filteredKeepedSuggestions = keepedSuggestions.filter(
            (suggestion) => !crossFileIds?.has(suggestion.id),
        );

        // Aplicar safeguard apenas nas sugestões não cross-file
        const safeGuardResult = await this.applySafeguardFilter(
            filteredKeepedSuggestions,
            context,
            file,
            relevantContent,
            patchWithLinesStr,
            reviewModeResponse,
        );

        safeguardLLMProvider = safeGuardResult.safeguardLLMProvider;

        discardedSuggestionsBySafeGuard.push(
            ...safeGuardResult.allDiscardedSuggestions,
            ...discardedSuggestionsByCodeDiff,
            ...discardedSuggestionsByKodyFineTuning,
        );

        const suggestionsWithSeverity =
            await this.suggestionService.analyzeSuggestionsSeverity(
                context?.organizationAndTeamData,
                context?.pullRequest?.number,
                safeGuardResult.safeguardSuggestions,
                context?.codeReviewConfig?.reviewOptions,
                context?.codeReviewConfig?.codeReviewVersion,
                context?.codeReviewConfig?.byokConfig,
            );

        const crossFileSuggestionsWithSeverity =
            await this.suggestionService.analyzeSuggestionsSeverity(
                context?.organizationAndTeamData,
                context?.pullRequest?.number,
                filteredCrossFileSuggestions,
                context?.codeReviewConfig?.reviewOptions,
                context?.codeReviewConfig?.codeReviewVersion,
                context?.codeReviewConfig?.byokConfig,
            );

        let mergedSuggestions = [];

        const kodyRulesSuggestions =
            await this.codeAnalysisOrchestrator.executeKodyRulesAnalysis(
                context?.organizationAndTeamData,
                context?.pullRequest?.number,
                { file, patchWithLinesStr },
                context,
                {
                    codeSuggestions: suggestionsWithSeverity,
                },
            );

        if (kodyRulesSuggestions?.codeSuggestions?.length > 0) {
            mergedSuggestions.push(...kodyRulesSuggestions.codeSuggestions);
        }

        // Se tem sugestões com severidade, adiciona também
        if (
            !kodyRulesSuggestions?.codeSuggestions?.length &&
            suggestionsWithSeverity?.length > 0
        ) {
            mergedSuggestions.push(...suggestionsWithSeverity);
        }

        const kodyASTSuggestions =
            await this.kodyAstAnalyzeContextPreparation.prepareKodyASTAnalyzeContext(
                context,
            );

        // Garantir que as sugestões do AST tenham IDs
        const kodyASTSuggestionsWithId = await this.addSuggestionsId(
            kodyASTSuggestions?.codeSuggestions || [],
        );

        mergedSuggestions = [
            ...mergedSuggestions,
            ...kodyASTSuggestionsWithId,
            ...crossFileSuggestionsWithSeverity,
        ];

        const VALID_ACTIONS = [
            'synchronize',
            'update',
            'updated',
            'git.pullrequest.updated',
        ];

        // If it's a commit, validate repeated suggestions
        if (context?.action && VALID_ACTIONS.includes(context.action)) {
            const savedSuggestions =
                await this.pullRequestService.findSuggestionsByPRAndFilename(
                    context?.pullRequest?.number,
                    context?.pullRequest?.base?.repo?.fullName,
                    file.filename,
                    context.organizationAndTeamData,
                );

            if (savedSuggestions?.length > 0) {
                const sentSuggestions = savedSuggestions.filter(
                    (suggestion) =>
                        suggestion.deliveryStatus === DeliveryStatus.SENT &&
                        suggestion.implementationStatus ===
                            ImplementationStatus.NOT_IMPLEMENTED,
                );

                if (mergedSuggestions?.length > 0) {
                    mergedSuggestions =
                        await this.suggestionService.removeSuggestionsRelatedToSavedFiles(
                            context?.organizationAndTeamData,
                            context?.pullRequest?.number.toString(),
                            savedSuggestions,
                            mergedSuggestions,
                        );
                }

                // We can only validate the implementation of suggestions that were sent
                if (sentSuggestions.length > 0) {
                    await this.suggestionService.validateImplementedSuggestions(
                        context?.organizationAndTeamData,
                        file?.patch,
                        sentSuggestions,
                        context?.pullRequest?.number,
                    );
                }
            }
        }

        if (mergedSuggestions?.length > 0) {
            await Promise.all(
                mergedSuggestions.map(async (suggestion) => {
                    suggestion.rankScore =
                        await this.suggestionService.calculateSuggestionRankScore(
                            suggestion,
                        );
                }),
            );
        }

        validSuggestionsToAnalyze.push(...mergedSuggestions);

        return {
            validSuggestionsToAnalyze,
            discardedSuggestionsBySafeGuard:
                discardedSuggestionsBySafeGuard || [],
            reviewMode: reviewModeResponse,
            codeReviewModelUsed: {
                generateSuggestions:
                    result?.codeReviewModelUsed?.generateSuggestions,
                safeguard: safeguardLLMProvider,
            },
        };
    }

    private async addSuggestionsId(suggestions: any[]): Promise<any[]> {
        return suggestions?.map((suggestion) => ({
            ...suggestion,
            id: suggestion?.id || uuidv4(),
        }));
    }

    private async initialFilterSuggestions(
        result: AIAnalysisResult,
        context: AnalysisContext,
        crossFileAnalysis: CodeSuggestion[],
        patchWithLinesStr: string,
    ): Promise<{
        filteredSuggestions: Partial<CodeSuggestion>[];
        discardedSuggestionsByCodeDiff: Partial<CodeSuggestion>[];
    }> {
        // Combinar sugestões regulares com cross-file suggestions
        const allSuggestions = [
            ...(result.codeSuggestions || []),
            ...crossFileAnalysis,
        ];

        // Adicionar IDs apenas uma vez, aqui
        const suggestionsWithId = await this.addSuggestionsId(allSuggestions);

        const combinedResult = {
            ...result,
            codeSuggestions: suggestionsWithId,
        };

        let filteredSuggestionsByOptions =
            this.suggestionService.filterCodeSuggestionsByReviewOptions(
                context?.codeReviewConfig?.reviewOptions,
                combinedResult,
            );

        const filterSuggestionsCodeDiff =
            await this.suggestionService.filterSuggestionsCodeDiff(
                patchWithLinesStr,
                filteredSuggestionsByOptions.codeSuggestions,
            );

        const discardedSuggestionsByCodeDiff =
            this.suggestionService.getDiscardedSuggestions(
                filteredSuggestionsByOptions.codeSuggestions,
                filterSuggestionsCodeDiff,
                PriorityStatus.DISCARDED_BY_CODE_DIFF,
            );

        return {
            filteredSuggestions: filterSuggestionsCodeDiff,
            discardedSuggestionsByCodeDiff,
        };
    }

    private async applyKodyFineTuningFilter(
        filteredSuggestions: any[],
        context: AnalysisContext,
    ): Promise<{
        keepedSuggestions: Partial<CodeSuggestion>[];
        discardedSuggestionsByKodyFineTuning: Partial<CodeSuggestion>[];
    }> {
        const getDataPipelineKodyFineTunning =
            await this.kodyFineTuningContextPreparation.prepareKodyFineTuningContext(
                context?.organizationAndTeamData.organizationId,
                context?.pullRequest?.number,
                {
                    id: context?.pullRequest?.repository?.id || '',
                    full_name: context?.pullRequest?.repository?.fullName || '',
                },
                filteredSuggestions,
                context?.codeReviewConfig?.kodyFineTuningConfig?.enabled,
                context?.clusterizedSuggestions,
            );

        const keepedSuggestions: Partial<CodeSuggestion>[] =
            getDataPipelineKodyFineTunning?.keepedSuggestions;

        const discardedSuggestions: Partial<CodeSuggestion>[] =
            getDataPipelineKodyFineTunning?.discardedSuggestions;

        const discardedSuggestionsByKodyFineTuning = discardedSuggestions.map(
            (suggestion) => {
                suggestion.priorityStatus =
                    PriorityStatus.DISCARDED_BY_KODY_FINE_TUNING;
                return suggestion;
            },
        );

        return {
            keepedSuggestions,
            discardedSuggestionsByKodyFineTuning,
        };
    }

    private async applySafeguardFilter(
        suggestions: Partial<CodeSuggestion>[],
        context: AnalysisContext,
        file: any,
        relevantContent,
        patchWithLinesStr: string,
        reviewModeResponse: any,
    ): Promise<{
        safeguardSuggestions: Partial<CodeSuggestion>[];
        allDiscardedSuggestions: Partial<CodeSuggestion>[];
        safeguardLLMProvider: string;
    }> {
        let filteredSuggestions = suggestions;
        let discardedSuggestionsBySeverity = [];

        if (
            context?.codeReviewConfig?.codeReviewVersion ===
            CodeReviewVersion.v2
        ) {
            const prioritizedSuggestions =
                await this.prioritizeSuggestionsBySeverityBeforeSafeGuard(
                    suggestions,
                    context,
                );

            filteredSuggestions = prioritizedSuggestions.filter(
                (suggestion) =>
                    suggestion.priorityStatus === PriorityStatus.PRIORITIZED,
            );

            discardedSuggestionsBySeverity = prioritizedSuggestions.filter(
                (suggestion) =>
                    suggestion.priorityStatus ===
                    PriorityStatus.DISCARDED_BY_SEVERITY,
            );
        }

        const safeGuardResponse =
            await this.suggestionService.filterSuggestionsSafeGuard(
                context?.organizationAndTeamData,
                context?.pullRequest?.number,
                file,
                relevantContent,
                patchWithLinesStr,
                filteredSuggestions,
                context?.codeReviewConfig?.languageResultPrompt,
                reviewModeResponse,
                context?.codeReviewConfig?.byokConfig,
            );

        const safeguardLLMProvider =
            safeGuardResponse?.codeReviewModelUsed?.safeguard || '';

        const discardedSuggestionsBySafeGuard =
            this.suggestionService.getDiscardedSuggestions(
                filteredSuggestions,
                safeGuardResponse?.suggestions || [],
                PriorityStatus.DISCARDED_BY_SAFEGUARD,
            );

        const allDiscardedSuggestions = [
            ...discardedSuggestionsBySeverity,
            ...discardedSuggestionsBySafeGuard,
        ];

        return {
            safeguardSuggestions: safeGuardResponse?.suggestions || [],
            allDiscardedSuggestions,
            safeguardLLMProvider,
        };
    }

    private async prioritizeSuggestionsBySeverityBeforeSafeGuard(
        suggestions: Partial<CodeSuggestion>[],
        context: AnalysisContext,
    ): Promise<Partial<CodeSuggestion>[]> {
        const prioritizedSuggestions =
            await this.suggestionService.filterSuggestionsBySeverityLevel(
                suggestions,
                context?.codeReviewConfig?.suggestionControl
                    ?.severityLevelFilter,
                context?.organizationAndTeamData,
                context?.pullRequest?.number,
            );

        return prioritizedSuggestions;
    }

    private createAnalysisContextFromPipelineContext(
        context: CodeReviewPipelineContext,
    ): AnalysisContext {
        return {
            organizationAndTeamData: context.organizationAndTeamData,
            repository: context.repository,
            pullRequest: context.pullRequest,
            action: context.action,
            platformType: context.platformType,
            codeReviewConfig: context.codeReviewConfig,
            clusterizedSuggestions: context.clusterizedSuggestions,
            validCrossFileSuggestions:
                context.prAnalysisResults?.validCrossFileSuggestions || [],
            tasks: context.tasks,
            externalPromptContext: context.externalPromptContext,
            externalPromptLayers: context.externalPromptLayers,
            correlationId: context.correlationId,
            sharedContextPack: context.sharedContextPack,
            augmentationsByFile: context.augmentationsByFile,
            filePromptOverrides: this.buildFilePromptOverrides(
                context.fileContextMap,
            ),
        };
    }

    private buildFilePromptOverrides(
        fileContextMap?: Record<string, FileContextAgentResult>,
    ): Record<string, CodeReviewConfig['v2PromptOverrides']> | undefined {
        if (!fileContextMap) {
            return undefined;
        }

        const map: Record<string, CodeReviewConfig['v2PromptOverrides']> = {};
        for (const [fileName, entry] of Object.entries(fileContextMap)) {
            if (entry?.resolvedPromptOverrides) {
                map[fileName] = entry.resolvedPromptOverrides;
            }
        }

        return Object.keys(map).length ? map : undefined;
    }
}
