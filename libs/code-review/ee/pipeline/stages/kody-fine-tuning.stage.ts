import { Injectable } from '@nestjs/common';
import { KodyFineTuningService } from '@/core/infrastructure/adapters/services/kodyFineTuning/kodyFineTuning.service';
import { BaseStage } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/base/base-stage.abstract';
import { CodeReviewPipelineContext } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/context/code-review-pipeline.context';

@Injectable()
export class KodyFineTuningStage extends BaseStage {
    readonly name = 'KodyFineTuningStage';
    readonly dependsOn: string[] = []; // No dependencies

    constructor(private readonly kodyFineTuningService: KodyFineTuningService) {
        super();
    }

    async execute(
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
