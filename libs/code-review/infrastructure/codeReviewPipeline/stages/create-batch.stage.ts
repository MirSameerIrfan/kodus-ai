import { createLogger } from "@kodus/flow";
import { Injectable } from '@nestjs/common';
import { BasePipelineStage } from '../../../pipeline/base-stage.abstract';
import { FileChange } from '@/config/types/general/codeReview.type';
import { createOptimizedBatches } from '@shared/utils/batch.helper';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';

@Injectable()
export class BatchCreationStage extends BasePipelineStage<CodeReviewPipelineContext> {
    private readonly logger = createLogger(BatchCreationStage.name);
    stageName = 'BatchCreationStage';

    constructor() {
        super();
    }

    protected async executeStage(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        const batches = this.createOptimizedBatches(context.changedFiles);

        return this.updateContext(context, (draft) => {
            draft.batches = batches;
        });
    }

    private createOptimizedBatches(files: FileChange[]): FileChange[][] {
        const batches = createOptimizedBatches(files, {
            minBatchSize: 20,
            maxBatchSize: 30,
        });

        this.validateBatchIntegrity(batches, files.length);

        this.logger.log({
            message: `Created ${batches.length} batches for ${files.length} files.`,
            context: this.stageName,
        });

        return batches;
    }

    private validateBatchIntegrity(
        batches: FileChange[][],
        totalFileCount: number,
    ): void {
        const totalFilesInBatches = batches.reduce(
            (sum, batch) => sum + batch.length,
            0,
        );
        if (totalFilesInBatches !== totalFileCount) {
            this.logger.warn({
                message: `File count mismatch! Total: ${totalFileCount}, In batches: ${totalFilesInBatches}`,
                context: this.stageName,
            });

            batches.length = 0;
            batches.push(Array.from({ length: totalFileCount }));
        }
    }
}
