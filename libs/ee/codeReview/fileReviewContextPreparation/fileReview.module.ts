import { forwardRef, Module } from '@nestjs/common';

import { CodebaseModule } from '@libs/code-review/code-review.module';
import { FILE_REVIEW_CONTEXT_PREPARATION_PROVIDER } from '@libs/core/providers/file-analyzer.provider.ee';
import { FILE_REVIEW_CONTEXT_PREPARATION_TOKEN } from '@libs/core/domain/interfaces/file-review-context-preparation.interface';
import { FileReviewContextPreparation } from './file-review-context-preparation.service';

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
