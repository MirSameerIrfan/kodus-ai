/**
 * @license
 * Kodus Tech. All rights reserved.
 */

import { Injectable } from '@nestjs/common';
import { BaseKodyASTAnalyzeContextPreparation } from './base-ast-analyze.abstract';
import { PinoLoggerService } from '@libs/core/log/pino.service';
import {
    AIAnalysisResult,
    AnalysisContext,
} from '@libs/core/infrastructure/config/types/general/codeReview.type';

/**
 * Core implementation of Kody AST analysis context preparation
 * Provides minimal functionality for preparing Kody AST analysis context
 */
@Injectable()
export class KodyASTAnalyzeContextPreparationService extends BaseKodyASTAnalyzeContextPreparation {
    constructor(protected readonly logger: PinoLoggerService) {
        super(logger);
    }

    protected async prepareKodyASTAnalyzeContextInternal(
        _context: AnalysisContext,
    ): Promise<AIAnalysisResult | null> {
        return null;
    }
}
