/**
 * @license
 * Kodus Tech. All rights reserved.
 */

import { forwardRef, Module } from '@nestjs/common';

import { CodebaseModule } from '@libs/code-review/code-review.module';
import { KODY_AST_ANALYZE_CONTEXT_PREPARATION_PROVIDER } from '@libs/code-review/providers/kody-ast-analyze-context-preparation.provider.ee';
import { KODY_AST_ANALYZE_CONTEXT_PREPARATION_TOKEN } from '@libs/core/domain/interfaces/kody-ast-analyze-context-preparation.interface';
import { KodyASTAnalyzeContextPreparationService } from '@libs/code-review/ee/ast-analyze/kody-ast-analyze-context-preparation.service';

@Module({
    imports: [forwardRef(() => CodebaseModule)],
    providers: [
        KodyASTAnalyzeContextPreparationService, // Core implementation
        KODY_AST_ANALYZE_CONTEXT_PREPARATION_PROVIDER,
    ],
    exports: [
        KODY_AST_ANALYZE_CONTEXT_PREPARATION_TOKEN,
        KodyASTAnalyzeContextPreparationService,
    ],
})
export class KodyASTAnalyzeContextModule {}
