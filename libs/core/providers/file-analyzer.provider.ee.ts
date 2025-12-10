/**
 * @license
 * © Kodus Tech. All rights reserved.
 */
import { Provider } from '@nestjs/common';
import {
    FILE_REVIEW_CONTEXT_PREPARATION_TOKEN,
    IFileReviewContextPreparation,
} from '@libs/core/domain/interfaces/file-review-context-preparation.interface';
import { FileReviewContextPreparation as CoreFileReviewContextPreparation } from '@libs/code-review/infrastructure/adapters/services/code-analysis/file/noop-file-review.service';
import { FileReviewContextPreparation as ProFileReviewContextPreparation } from '@libs/ee/codeReview/fileReviewContextPreparation/file-review-context-preparation.service';
import { LLM_ANALYSIS_SERVICE_TOKEN } from '@libs/code-review/infrastructure/adapters/services/llmAnalysis.service';
import {
    AST_ANALYSIS_SERVICE_TOKEN,
    IASTAnalysisService,
} from '@libs/code-review/domain/contracts/ASTAnalysisService.contract';
import { IAIAnalysisService } from '@libs/code-review/domain/contracts/AIAnalysisService.contract';
import { environment } from '@libs/ee/configs/environment';
import { SimpleLogger } from '@kodus/flow/dist/observability/logger';

export const FILE_REVIEW_CONTEXT_PREPARATION_PROVIDER: Provider = {
    provide: FILE_REVIEW_CONTEXT_PREPARATION_TOKEN,
    useFactory: (
        corePreparation: CoreFileReviewContextPreparation,
        simpleLogger: SimpleLogger,
        aiAnalysisService: IAIAnalysisService,
        astAnalysisService: IASTAnalysisService,
    ): IFileReviewContextPreparation => {
        const isCloud = environment.API_CLOUD_MODE;

        if (isCloud) {
            return new ProFileReviewContextPreparation(
                astAnalysisService,
                aiAnalysisService,
                PinoLoggerService,
            );
        }

        return corePreparation;
    },
    inject: [
        CoreFileReviewContextPreparation,
        PinoLoggerService,
        LLM_ANALYSIS_SERVICE_TOKEN,
        AST_ANALYSIS_SERVICE_TOKEN,
    ],
};
