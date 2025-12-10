import { BasePipelineStage } from '@libs/core/infrastructure/pipeline/abstracts/base-stage.abstract';
import { Injectable } from '@nestjs/common';
import { PinoLoggerService } from '@libs/log/pino.service';
import { FileContextAugmentationService } from '@libs/code-review/infrastructure/context/file-context-augmentation.service';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';

@Injectable()
export class FileContextGateStage extends BasePipelineStage<CodeReviewPipelineContext> {
    readonly stageName = 'FileContextGateStage';

    constructor(
        private readonly logger: PinoLoggerService,
        private readonly fileContextAugmentationService: FileContextAugmentationService,
    ) {
        super();
    }

    protected async executeStage(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        if (!context.changedFiles?.length) {
            return context;
        }

        const mcpDependencies =
            context.sharedContextPack?.dependencies?.filter(
                (dep) => dep.type === 'mcp',
            ) ?? [];

        if (!mcpDependencies.length) {
            return context;
        }

        const augmentationsByFile =
            await this.fileContextAugmentationService.augmentFiles(
                context.changedFiles,
                context,
                mcpDependencies,
            );

        return this.updateContext(context, (draft) => {
            draft.augmentationsByFile = augmentationsByFile;
        });
    }
}
