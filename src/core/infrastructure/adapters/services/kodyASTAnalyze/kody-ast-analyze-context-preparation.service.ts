import { createLogger } from '@kodus/flow';
/**
 * @license
 * Kodus Tech. All rights reserved.
 */

import {
    AIAnalysisResult,
    AnalysisContext,
} from '@/config/types/general/codeReview.type';
import { Injectable } from '@nestjs/common';
import { BaseKodyASTAnalyzeContextPreparation } from './base-ast-analyze.service';

/**
 * Core implementation of Kody AST analysis context preparation
 * Provides minimal functionality for preparing Kody AST analysis context
 */
@Injectable()
export class KodyASTAnalyzeContextPreparationService extends BaseKodyASTAnalyzeContextPreparation {
    protected readonly logger = createLogger(
        KodyASTAnalyzeContextPreparationService.name,
    );
    constructor() {
        super();
    }

    protected async prepareKodyASTAnalyzeContextInternal(
        context: AnalysisContext,
    ): Promise<AIAnalysisResult | null> {
        return null;
    }
}
