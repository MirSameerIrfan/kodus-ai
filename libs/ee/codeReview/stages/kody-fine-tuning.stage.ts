import { KodyFineTuningService } from '@libs/kodyFineTuning/infrastructure/adapters/services/kodyFineTuning.service';
import { CodeReviewPipelineContext } from '@libs/code-review/pipeline/context/code-review-pipeline.context';
import { BasePipelineStage } from '@libs/core/infrastructure/pipeline/abstracts/base-stage.abstract';
import { Injectable } from '@nestjs/common';

@Injectable()
export class KodyFineTuningStage extends BasePipelineStage<CodeReviewPipelineContext> {
    stageName = 'KodyFineTuningStage';

    constructor(private readonly kodyFineTuningService: KodyFineTuningService) {
        super();
    }

    protected async executeStage(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        if (!context.codeReviewConfig.kodyFineTuningConfig?.enabled) {
            return context;
        }

        const clusterizedSuggestions =
            await this.kodyFineTuningService.startAnalysis(
                context.organizationAndTeamData.organizationId,
                {
                    id: context.repository.id,
                    full_name: context.repository.fullName,
                },
                context.pullRequest.number,
                context.repository.language,
            );

        return this.updateContext(context, (draft) => {
            draft.clusterizedSuggestions = clusterizedSuggestions;
        });
    }
}
