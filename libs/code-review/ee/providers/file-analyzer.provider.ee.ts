/**
 * @license
 * © Kodus Tech. All rights reserved.
 */
import { IAIAnalysisService } from '@libs/code-review/domain/contracts/AIAnalysisService.contract';
import {
    AST_ANALYSIS_SERVICE_TOKEN,
    IASTAnalysisService,
} from '@libs/code-review/domain/contracts/ASTAnalysisService.contract';
import { FileReviewContextPreparation as ProFileReviewContextPreparation } from '@libs/code-review/ee/pipeline/fileReviewContextPreparation/file-review-context-preparation.service';
import { environment } from '@libs/common/ee/configs/environment';
import {
    FILE_REVIEW_CONTEXT_PREPARATION_TOKEN,
    IFileReviewContextPreparation,
} from '@libs/common/interfaces/file-review-context-preparation.interface';
import { Provider } from '@nestjs/common';
import { LLM_ANALYSIS_SERVICE_TOKEN } from '../adapters/services/codeBase/llmAnalysis.service';
import { FileReviewContextPreparation as CoreFileReviewContextPreparation } from '../adapters/services/fileReviewContextPreparation/file-review-context-preparation.service';

export const FILE_REVIEW_CONTEXT_PREPARATION_PROVIDER: Provider = {
    provide: FILE_REVIEW_CONTEXT_PREPARATION_TOKEN,
    useFactory: (
        corePreparation: CoreFileReviewContextPreparation,
        aiAnalysisService: IAIAnalysisService,
        astAnalysisService: IASTAnalysisService,
    ): IFileReviewContextPreparation => {
        const isCloud = environment.API_CLOUD_MODE;

        if (isCloud) {
            return new ProFileReviewContextPreparation(
                astAnalysisService,
                aiAnalysisService,
            );
        }

        return corePreparation;
    },
    inject: [
        CoreFileReviewContextPreparation,
        LLM_ANALYSIS_SERVICE_TOKEN,
        AST_ANALYSIS_SERVICE_TOKEN,
    ],
};
