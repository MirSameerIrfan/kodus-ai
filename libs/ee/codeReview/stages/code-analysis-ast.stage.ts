import {
    AST_ANALYSIS_SERVICE_TOKEN,
    IASTAnalysisService,
} from '@libs/code-review/domain/contracts/ASTAnalysisService.contract';
import { CodeReviewPipelineContext } from '@libs/code-review/pipeline/context/code-review-pipeline.context';
import { BasePipelineStage } from '@libs/core/infrastructure/pipeline/abstracts/base-stage.abstract';
import { PinoLoggerService } from '@libs/core/log/pino.service';
import { Injectable, Inject } from '@nestjs/common';

const ENABLE_CODE_REVIEW_AST =
    process.env.API_ENABLE_CODE_REVIEW_AST === 'true';

@Injectable()
export class CodeAnalysisASTStage extends BasePipelineStage<CodeReviewPipelineContext> {
    stageName = 'CodeAnalysisASTStage';

    constructor(
        @Inject(AST_ANALYSIS_SERVICE_TOKEN)
        private readonly codeASTAnalysisService: IASTAnalysisService,

        private readonly logger: PinoLoggerService,
    ) {
        super();
    }

    protected async executeStage(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        if (
            !ENABLE_CODE_REVIEW_AST ||
            !context.codeReviewConfig.reviewOptions?.breaking_changes
        ) {
            return context;
        }

        try {
            const { taskId } =
                await this.codeASTAnalysisService.initializeASTAnalysis(
                    context.repository,
                    context.pullRequest,
                    context.platformType,
                    context.organizationAndTeamData,
                );

            return this.updateContext(context, (draft) => {
                draft.tasks.astAnalysis.taskId = taskId;
            });
        } catch (error) {
            this.logger.error({
                message: 'Error during AST analysis initialization',
                error,
                context: this.stageName,
                metadata: {
                    ...context.organizationAndTeamData,
                    pullRequestNumber: context.pullRequest.number,
                },
            });
            return context;
        }
    }
}
