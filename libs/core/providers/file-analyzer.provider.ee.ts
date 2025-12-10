/**
 * @license
 * © Kodus Tech. All rights reserved.
 */
import { Provider } from '@nestjs/common';
import { FILE_REVIEW_CONTEXT_PREPARATION_TOKEN } from '../domain/interfaces/file-review-context-preparation.interface';

export const FILE_REVIEW_CONTEXT_PREPARATION_PROVIDER: Provider = {
    provide: FILE_REVIEW_CONTEXT_PREPARATION_TOKEN,
    useFactory: (
        corePreparation: CoreFileReviewContextPreparation,
        PinoLoggerService: PinoLoggerService,
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
