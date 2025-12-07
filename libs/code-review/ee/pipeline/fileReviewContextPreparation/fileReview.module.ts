import { forwardRef, Module } from '@nestjs/common';
import { FileReviewContextPreparation } from '@libs/code-review/infrastructure/file-review/file-review-context-preparation.service';
import { FILE_REVIEW_CONTEXT_PREPARATION_TOKEN } from '@shared/interfaces/file-review-context-preparation.interface';
import { FILE_REVIEW_CONTEXT_PREPARATION_PROVIDER } from '@libs/code-review/providers/file-analyzer.provider.ee';
import { CodebaseModule } from '@libs/code-review/code-review.module';

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
