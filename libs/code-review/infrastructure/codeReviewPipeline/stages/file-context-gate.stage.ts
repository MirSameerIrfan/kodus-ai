import { createLogger } from '@kodus/flow';
import { Injectable } from '@nestjs/common';
import { BaseStage } from './base/base-stage.abstract';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';
import { FileContextAugmentationService } from '../../context/file-context-augmentation.service';

@Injectable()
export class FileContextGateStage extends BaseStage {
    private readonly logger = createLogger(FileContextGateStage.name);
    readonly name = 'FileContextGateStage';
    readonly dependsOn: string[] = ['LoadExternalContextStage']; // Depends on LoadExternalContextStage

    constructor(
        private readonly fileContextAugmentationService: FileContextAugmentationService,
    ) {
        super();
    }

    async execute(
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
