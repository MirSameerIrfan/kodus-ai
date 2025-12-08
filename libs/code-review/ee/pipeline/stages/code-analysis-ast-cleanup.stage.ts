import { createLogger } from '@kodus/flow';
import { Injectable, Inject } from '@nestjs/common';
import {
    AST_ANALYSIS_SERVICE_TOKEN,
    IASTAnalysisService,
} from '@libs/code-review/domain/contracts/ASTAnalysisService.contract';
import { BaseStage } from '@libs/code-review/infrastructure/codeReviewPipeline/stages/base/base-stage.abstract';
import { CodeReviewPipelineContext } from '@libs/code-review/infrastructure/codeReviewPipeline/context/code-review-pipeline.context';

const ENABLE_CODE_REVIEW_AST =
    process.env.API_ENABLE_CODE_REVIEW_AST === 'true';

@Injectable()
export class CodeAnalysisASTCleanupStage extends BaseStage {
    private readonly logger = createLogger(CodeAnalysisASTCleanupStage.name);
    readonly name = 'CodeAnalysisASTCleanupStage';
    readonly dependsOn: string[] = ['CodeAnalysisASTStage']; // Depends on CodeAnalysisASTStage

    constructor(
        @Inject(AST_ANALYSIS_SERVICE_TOKEN)
        private readonly codeASTAnalysisService: IASTAnalysisService,
    ) {
        super();
    }

    async execute(
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
                context.tasks?.astAnalysis?.taskId || '',
            );

            return context;
        } catch (error) {
            this.logger.error({
                message: 'Error during AST analysis cleanup',
                error,
                context: this.name,
                metadata: {
                    ...context.organizationAndTeamData,
                    pullRequestNumber: context.pullRequest.number,
                },
            });
            return context;
        }
    }
}
