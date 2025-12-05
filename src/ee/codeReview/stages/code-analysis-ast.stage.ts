import { createLogger } from "@kodus/flow";
import { Injectable, Inject } from '@nestjs/common';
import {
    AST_ANALYSIS_SERVICE_TOKEN,
    IASTAnalysisService,
} from '@/core/domain/codeBase/contracts/ASTAnalysisService.contract';
import { BaseStage } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/base/base-stage.abstract';
import { HeavyStage } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/base/heavy-stage.interface';
import { CodeReviewPipelineContext } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/context/code-review-pipeline.context';
import { EventType } from '@/core/domain/workflowQueue/enums/event-type.enum';
import { WorkflowPausedError } from '@/core/domain/workflowQueue/errors/workflow-paused.error';
import { TaskStatus } from '@/ee/kodyAST/codeASTAnalysis.service';

const ENABLE_CODE_REVIEW_AST =
    process.env.API_ENABLE_CODE_REVIEW_AST === 'true';

@Injectable()
export class CodeAnalysisASTStage extends BaseStage implements HeavyStage {
    private readonly logger = createLogger(CodeAnalysisASTStage.name);
    readonly name = 'CodeAnalysisASTStage';
    readonly dependsOn: string[] = []; // No dependencies

    // HeavyStage properties
    readonly timeout = 5 * 60 * 1000; // 5 minutes
    readonly eventType = EventType.AST_ANALYSIS_COMPLETED;

    constructor(
        @Inject(AST_ANALYSIS_SERVICE_TOKEN)
        private readonly codeASTAnalysisService: IASTAnalysisService
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
     * Initializes AST analysis and returns taskId
     */
    async start(context: CodeReviewPipelineContext): Promise<string> {
        if (
            !ENABLE_CODE_REVIEW_AST ||
            !context.codeReviewConfig.reviewOptions?.breaking_changes
        ) {
            // AST not enabled, return a dummy taskId and skip
            return 'skipped';
        }

        try {
            const { taskId } =
                await this.codeASTAnalysisService.initializeASTAnalysis(
                    context.repository,
                    context.pullRequest,
                    context.platformType,
                    context.organizationAndTeamData,
                );

            this.logger.log({
                message: `AST analysis started for PR#${context.pullRequest.number}`,
                context: this.name,
                metadata: {
                    taskId,
                    prNumber: context.pullRequest.number,
                    correlationId: context.correlationId,
                },
            });

            // Update context with taskId
            context = this.updateContext(context, (draft) => {
                if (!draft.tasks) {
                    draft.tasks = {};
                }
                if (!draft.tasks.astAnalysis) {
                    draft.tasks.astAnalysis = {
                        taskId: '',
                        status: TaskStatus.TASK_STATUS_UNSPECIFIED,
                    };
                }
                draft.tasks.astAnalysis.taskId = taskId;
            });

            return taskId;
        } catch (error) {
            this.logger.error({
                message: 'Error during AST analysis initialization',
                error,
                context: this.name,
                metadata: {
                    ...context.organizationAndTeamData,
                    pullRequestNumber: context.pullRequest.number,
                },
            });
            throw error;
        }
    }

    /**
     * Get result of heavy stage execution
     * Fetches the completed AST result using awaitTask
     */
    async getResult(
        context: CodeReviewPipelineContext,
        taskId: string,
    ): Promise<CodeReviewPipelineContext> {
        if (taskId === 'skipped') {
            return context;
        }

        try {
            // Fetch completed AST result
            const taskResult = await this.codeASTAnalysisService.awaitTask(
                taskId,
                context.organizationAndTeamData,
                {
                    timeout: this.timeout,
                    initialInterval: 1000,
                    maxInterval: 30000,
                    useExponentialBackoff: true,
                },
            );

            if (!taskResult) {
                this.logger.warn({
                    message: `AST task ${taskId} returned null result`,
                    context: this.name,
                    metadata: { taskId },
                });
                return context;
            }

            // Update context with AST result
            return this.updateContext(context, (draft) => {
                if (!draft.tasks) {
                    draft.tasks = {};
                }
                if (!draft.tasks.astAnalysis) {
                    draft.tasks.astAnalysis = {
                        taskId: '',
                        status: TaskStatus.TASK_STATUS_UNSPECIFIED,
                    };
                }
                draft.tasks.astAnalysis.taskId = taskId;
                draft.tasks.astAnalysis.status = taskResult.task.status;
                draft.tasks.astAnalysis.hasRelevantContent =
                    taskResult.task.hasRelevantContent;
            });
        } catch (error) {
            this.logger.error({
                message: `Error fetching AST result for task ${taskId}`,
                context: this.name,
                error,
                metadata: { taskId },
            });
            throw error;
        }
    }

    /**
     * Resume heavy stage execution after pause
     * AST result was already applied in getResult(), just return context
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
        if (
            !ENABLE_CODE_REVIEW_AST ||
            !context.codeReviewConfig.reviewOptions?.breaking_changes
        ) {
            // AST not enabled, skip stage
            return context;
        }

        // Start heavy stage and get taskId
        const taskId = await this.start(context);

        // Throw WorkflowPausedError to pause workflow
        // Worker will be freed and workflow will resume when AST completion event arrives
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
}
