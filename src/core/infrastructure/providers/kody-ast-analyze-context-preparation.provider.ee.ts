/**
 * @license
 * Kodus Tech. All rights reserved.
 */

import { CodeAnalysisOrchestrator } from '@/ee/codeBase/codeAnalysisOrchestrator.service';
import { environment } from '@/ee/configs/environment';
import { KodyASTAnalyzeContextPreparationServiceEE } from '@/ee/kodyASTAnalyze/kody-ast-analyze-context-preparation.ts';
import {
    IKodyASTAnalyzeContextPreparationService,
    KODY_AST_ANALYZE_CONTEXT_PREPARATION_TOKEN,
} from '@/shared/interfaces/kody-ast-analyze-context-preparation.interface';
import { Provider } from '@nestjs/common';
import { KodyASTAnalyzeContextPreparationService } from '../adapters/services/kodyASTAnalyze/kody-ast-analyze-context-preparation.service';

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
