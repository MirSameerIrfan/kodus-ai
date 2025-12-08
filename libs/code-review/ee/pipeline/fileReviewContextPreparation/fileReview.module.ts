import { forwardRef, Module } from '@nestjs/common';
import { FILE_REVIEW_CONTEXT_PREPARATION_TOKEN } from '@libs/common/interfaces/file-review-context-preparation.interface';
import { CodebaseModule } from '@libs/code-review/code-review.module';
import { FileReviewContextPreparation } from '@libs/code-review/ee/pipeline/fileReviewContextPreparation/file-review-context-preparation.service';
import { FILE_REVIEW_CONTEXT_PREPARATION_PROVIDER } from '@libs/code-review/ee/providers/file-analyzer.provider.ee';

@Module({
    imports: [forwardRef(() => CodebaseModule)],
    providers: [
        FileReviewContextPreparation, // Core implementation
        FILE_REVIEW_CONTEXT_PREPARATION_PROVIDER,
    ],
    exports: [
        FILE_REVIEW_CONTEXT_PREPARATION_TOKEN,
        FileReviewContextPreparation,
    ],
})
export class FileReviewModule {}
