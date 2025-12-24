/**
 * @license
 * Kodus Tech. All rights reserved.
 */

import { CodebaseModule } from '@libs/code-review/modules/codebase.module';
import { KodyASTAnalyzeContextPreparationService } from '@libs/code-review/infrastructure/adapters/services/code-analysis/ast/noop-ast-analyze.service';
import { KODY_AST_ANALYZE_CONTEXT_PREPARATION_TOKEN } from '@libs/core/domain/interfaces/kody-ast-analyze-context-preparation.interface';
import { KODY_AST_ANALYZE_CONTEXT_PREPARATION_PROVIDER } from '@libs/core/providers/kody-ast-analyze-context-preparation.provider.ee';
import { forwardRef, Module } from '@nestjs/common';

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
