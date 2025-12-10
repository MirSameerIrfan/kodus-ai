import {
    AST_ANALYSIS_SERVICE_TOKEN,
    IASTAnalysisService,
} from '@libs/code-review/domain/contracts/ASTAnalysisService.contract';
import { CodeReviewPipelineContext } from '@libs/code-review/pipeline/context/code-review-pipeline.context';
import { BasePipelineStage } from '@libs/core/infrastructure/pipeline/abstracts/base-stage.abstract';
import { PinoLoggerService } from '@libs/log/pino.service';
import { Injectable, Inject } from '@nestjs/common';

const ENABLE_CODE_REVIEW_AST =
    process.env.API_ENABLE_CODE_REVIEW_AST === 'true';

@Injectable()
export class CodeAnalysisASTCleanupStage extends BasePipelineStage<CodeReviewPipelineContext> {
    stageName = 'CodeAnalysisASTCleanupStage';

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
            await this.codeASTAnalysisService.deleteASTAnalysis(
                context.repository,
                context.pullRequest,
                context.platformType,
                context.organizationAndTeamData,
                context.tasks.astAnalysis.taskId,
            );

            return context;
        } catch (error) {
            this.logger.error({
                message: 'Error during AST analysis cleanup',
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
