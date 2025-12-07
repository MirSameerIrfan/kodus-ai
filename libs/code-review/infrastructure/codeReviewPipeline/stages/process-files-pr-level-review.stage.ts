import { createLogger } from "@kodus/flow";
import { Inject, Injectable, Optional } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { BaseStage } from './base/base-stage.abstract';
import { HeavyStage } from './base/heavy-stage.interface';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';
import { KodyRulesScope } from '@libs/kody-rules/domain/interfaces/kodyRules.interface';
import {
    KODY_RULES_PR_LEVEL_ANALYSIS_SERVICE_TOKEN,
    KodyRulesPrLevelAnalysisService,
} from '@libs/code-review/ee/analysis/kodyRulesPrLevelAnalysis.service';
import { ReviewModeResponse } from '@/config/types/general/codeReview.type';
import {
    CROSS_FILE_ANALYSIS_SERVICE_TOKEN,
    CrossFileAnalysisService,
} from '../../crossFileAnalysis.service';
import { EventType } from '@libs/workflow-queue/domain/enums/event-type.enum';
import { StageCompletedEvent } from '@libs/workflow-queue/domain/interfaces/stage-completed-event.interface';
import { WorkflowPausedError } from '@libs/workflow-queue/domain/errors/workflow-paused.error';

@Injectable()
export class ProcessFilesPrLevelReviewStage extends BaseStage implements HeavyStage {
    private readonly logger = createLogger(ProcessFilesPrLevelReviewStage.name);
    readonly name = 'PRLevelReviewStage';
    readonly dependsOn: string[] = ['InitialCommentStage']; // Depends on InitialCommentStage
    
    // HeavyStage properties
    readonly timeout = 10 * 60 * 1000; // 10 minutes
    readonly eventType = EventType.PR_LEVEL_REVIEW_COMPLETED;
    
    // Store results temporarily (in production, this would be in a database/cache)
    private readonly resultsCache = new Map<string, CodeReviewPipelineContext>();

    constructor(
        @Inject(KODY_RULES_PR_LEVEL_ANALYSIS_SERVICE_TOKEN)
        private readonly kodyRulesPrLevelAnalysisService: KodyRulesPrLevelAnalysisService,
        @Inject(CROSS_FILE_ANALYSIS_SERVICE_TOKEN)
        private readonly crossFileAnalysisService: CrossFileAnalysisService,
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
            message: `Starting PR-level review for PR#${context.pullRequest.number}`,
            context: this.name,
            metadata: {
                taskId,
                prNumber: context.pullRequest.number,
                correlationId: context.correlationId,
            },
        });

        // TODO: In future, this should enqueue the analysis and return immediately
        // For now, execute synchronously but store result for getResult/resume
        const result = await this.executeAnalysis(context);
        
        // Store result temporarily
        this.resultsCache.set(taskId, result);
        
        // Publish completion event (simulating async completion)
        await this.publishCompletionEvent(taskId, result, context);
        
        return taskId;
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
        // Validate context
        if (!context?.organizationAndTeamData) {
            this.logger.error({
                message: 'Missing organizationAndTeamData in context',
                context: this.name,
            });
            return context;
        }

        if (!context?.pullRequest?.number) {
            this.logger.error({
                message: 'Missing pullRequest data in context',
                context: this.name,
                metadata: {
                    organizationAndTeamData: context.organizationAndTeamData,
                },
            });
            return context;
        }

        if (!context?.repository?.name || !context?.repository?.id) {
            this.logger.error({
                message: 'Missing repository data in context',
                context: this.name,
                metadata: {
                    organizationAndTeamData: context.organizationAndTeamData,
                    prNumber: context.pullRequest.number,
                },
            });
            return context;
        }

        if (!context?.changedFiles?.length) {
            this.logger.warn({
                message: `No files to analyze for PR#${context.pullRequest.number}`,
                context: this.name,
                metadata: {
                    organizationId:
                        context.organizationAndTeamData.organizationId,
                    prNumber: context.pullRequest.number,
                },
            });
            return context;
        }

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
        if (!context?.organizationAndTeamData) {
            this.logger.error({
                message: 'Missing organizationAndTeamData in context',
                context: this.stageName,
            });
            return context;
        }

        if (!context?.pullRequest?.number) {
            this.logger.error({
                message: 'Missing pullRequest data in context',
                context: this.stageName,
                metadata: {
                    organizationAndTeamData: context.organizationAndTeamData,
                },
            });
            return context;
        }

        if (!context?.repository?.name || !context?.repository?.id) {
            this.logger.error({
                message: 'Missing repository data in context',
                context: this.stageName,
                metadata: {
                    organizationAndTeamData: context.organizationAndTeamData,
                    prNumber: context.pullRequest.number,
                },
            });
            return context;
        }

        if (!context?.changedFiles?.length) {
            this.logger.warn({
                message: `No files to analyze for PR#${context.pullRequest.number}`,
                context: this.stageName,
                metadata: {
                    organizationId:
                        context.organizationAndTeamData.organizationId,
                    prNumber: context.pullRequest.number,
                },
            });
            return context;
        }

        //#region Kody Rules analysis
        try {
            const kodyRulesTurnedOn =
                context?.codeReviewConfig?.reviewOptions?.kody_rules;

            if (kodyRulesTurnedOn) {
                const prLevelRules =
                    context?.codeReviewConfig?.kodyRules?.filter(
                        (rule) => rule.scope === KodyRulesScope.PULL_REQUEST,
                    );

                if (prLevelRules?.length > 0) {
                    this.logger.log({
                        message: `Starting PR-level Kody Rules analysis for PR#${context.pullRequest.number}`,
                        context: this.name,
                        metadata: {
                            organizationAndTeamData:
                                context.organizationAndTeamData,
                            prNumber: context.pullRequest.number,
                        },
                    });

                    const kodyRulesPrLevelAnalysis =
                        await this.kodyRulesPrLevelAnalysisService.analyzeCodeWithAI(
                            context.organizationAndTeamData,
                            context.pullRequest.number,
                            context.changedFiles,
                            ReviewModeResponse.HEAVY_MODE,
                            context,
                        );

                    if (kodyRulesPrLevelAnalysis?.codeSuggestions?.length > 0) {
                        this.logger.log({
                            message: `PR-level analysis completed for PR#${context.pullRequest.number}`,
                            context: this.name,
                            metadata: {
                                suggestionsCount:
                                    kodyRulesPrLevelAnalysis?.codeSuggestions
                                        ?.length,
                                organizationAndTeamData:
                                    context.organizationAndTeamData,
                                prNumber: context.pullRequest.number,
                            },
                        });

                        const codeSuggestions =
                            kodyRulesPrLevelAnalysis?.codeSuggestions || [];

                        context = this.updateContext(context, (draft) => {
                            if (!draft.validSuggestionsByPR) {
                                draft.validSuggestionsByPR = [];
                            }

                            if (
                                codeSuggestions &&
                                Array.isArray(codeSuggestions)
                            ) {
                                draft.validSuggestionsByPR.push(
                                    ...codeSuggestions,
                                );
                            }
                        });
                    } else {
                        this.logger.warn({
                            message: `Analysis returned null for PR#${context.pullRequest.number}`,
                            context: this.name,
                            metadata: {
                                organizationAndTeamData:
                                    context.organizationAndTeamData,
                            },
                        });
                    }
                } else {
                    this.logger.log({
                        message: `No PR-level Kody Rules configured for PR#${context.pullRequest.number}`,
                        context: this.name,
                        metadata: {
                            organizationAndTeamData:
                                context.organizationAndTeamData,
                        },
                    });
                }
            }
        } catch (error) {
            this.logger.error({
                message: `Error during PR-level Kody Rules analysis for PR#${context.pullRequest.number}`,
                context: this.name,
                error,
                metadata: {
                    organizationAndTeamData: context.organizationAndTeamData,
                    prNumber: context.pullRequest.number,
                },
            });
        }
        //#endregion Kody Rules analysis

        //#region Cross-file analysis
        try {
            const preparedFilesData = context.changedFiles.map((file) => ({
                filename: file.filename,
                patchWithLinesStr: file.patchWithLinesStr,
            }));

            const crossFileAnalysis =
                await this.crossFileAnalysisService.analyzeCrossFileCode(
                    context.organizationAndTeamData,
                    context.pullRequest.number,
                    context,
                    preparedFilesData,
                );

            const crossFileAnalysisSuggestions =
                crossFileAnalysis?.codeSuggestions || [];

            if (crossFileAnalysisSuggestions.length > 0) {
                this.logger.log({
                    message: `Cross-file analysis completed for PR#${context.pullRequest.number}`,
                    context: this.name,
                    metadata: {
                        suggestionsCount: crossFileAnalysisSuggestions.length,
                        organizationAndTeamData:
                            context.organizationAndTeamData,
                        prNumber: context.pullRequest.number,
                    },
                });

                context = this.updateContext(context, (draft) => {
                    if (!draft.prAnalysisResults) {
                        draft.prAnalysisResults = {};
                    }
                    if (!draft.prAnalysisResults.validCrossFileSuggestions) {
                        draft.prAnalysisResults.validCrossFileSuggestions = [];
                    }
                    draft.prAnalysisResults.validCrossFileSuggestions.push(
                        ...crossFileAnalysisSuggestions,
                    );
                });
            } else {
                this.logger.log({
                    message: `No cross-file analysis suggestions found for PR#${context.pullRequest.number}`,
                    context: this.name,
                    metadata: {
                        organizationAndTeamData:
                            context.organizationAndTeamData,
                    },
                });
            }
        } catch (error) {
            this.logger.error({
                message: `Error during Cross-file analysis for PR#${context.pullRequest.number}`,
                context: this.name,
                error,
                metadata: {
                    organizationAndTeamData: context.organizationAndTeamData,
                    prNumber: context.pullRequest.number,
                },
            });
        }
        //#endregion Cross-file analysis
        return context;
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
                message: 'RabbitMQ not available, skipping PR-level review completion event',
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
                    validSuggestionsByPR: result.validSuggestionsByPR || [],
                    prAnalysisResults: result.prAnalysisResults,
                },
                metadata: {
                    workflowJobId: context.workflowJobId,
                    correlationId: context.correlationId,
                    prNumber: context.pullRequest.number,
                },
            };

            await this.amqpConnection.publish(
                'workflow.events',
                `stage.completed.${this.eventType}`,
                event,
                {
                    messageId: `pr-level-review-${taskId}`,
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
                message: `PR-level review completion event published for task ${taskId}`,
                context: this.name,
                metadata: { taskId, prNumber: context.pullRequest.number },
            });
        } catch (error) {
            this.logger.error({
                message: `Failed to publish PR-level review completion event for task ${taskId}`,
                context: this.name,
                error,
                metadata: { taskId },
            });
            // Don't throw - event publishing failure shouldn't break stage execution
        }
    }
}
