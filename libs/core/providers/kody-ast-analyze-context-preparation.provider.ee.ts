/**
 * @license
 * Kodus Tech. All rights reserved.
 */

import { Provider } from '@nestjs/common';
import {
    IKodyASTAnalyzeContextPreparationService,
    KODY_AST_ANALYZE_CONTEXT_PREPARATION_TOKEN,
} from '../domain/interfaces/kody-ast-analyze-context-preparation.interface';
import { KodyASTAnalyzeContextPreparationService } from '@libs/code-review/infrastructure/adapters/services/code-analysis/ast/noop-ast-analyze.service';
import { CodeAnalysisOrchestrator } from '@libs/ee/codeBase/codeAnalysisOrchestrator.service';
import { environment } from '@libs/ee/configs/environment';
import { KodyASTAnalyzeContextPreparationServiceEE } from '@libs/ee/kodyASTAnalyze/kody-ast-analyze-context-preparation.ts';

export const KODY_AST_ANALYZE_CONTEXT_PREPARATION_PROVIDER: Provider = {
    provide: KODY_AST_ANALYZE_CONTEXT_PREPARATION_TOKEN,
    useFactory: (
        corePreparation: KodyASTAnalyzeContextPreparationService,
        codeAnalysisOrchestrator: CodeAnalysisOrchestrator,
    ): IKodyASTAnalyzeContextPreparationService => {
        const isCloud = environment.API_CLOUD_MODE;

        if (isCloud) {
            return new KodyASTAnalyzeContextPreparationServiceEE(
                codeAnalysisOrchestrator,
            );
        }

        return corePreparation;
    },
    inject: [KodyASTAnalyzeContextPreparationService, CodeAnalysisOrchestrator],
};
