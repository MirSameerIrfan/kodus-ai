import { Injectable } from '@nestjs/common';
import { BasePipelineStage } from '../../../pipeline/base-stage.abstract';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';
import { PinoLoggerService } from '../../../logger/pino.service';
import { FileContextAugmentationService } from '../../../context/file-context-augmentation.service';

@Injectable()
export class FileContextGateStage extends BasePipelineStage<CodeReviewPipelineContext> {
    readonly stageName = 'FileContextGateStage';
    readonly dependsOn: string[] = ['LoadExternalContextStage']; // Depends on LoadExternalContextStage

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
