import { createLogger } from "@kodus/flow";
import { Injectable } from '@nestjs/common';
import { CodeReviewVersion } from '@/config/types/general/codeReview.type';
import * as labelsDataV2 from '@/core/infrastructure/adapters/services/automation/processAutomation/config/codeReview/labelsCodeReview_v2.json';
import * as labelsDataLegacy from '@/core/infrastructure/adapters/services/automation/processAutomation/config/codeReview/labelsCodeReview_legacy.json';

@Injectable()
export class ListCodeReviewAutomationLabelsUseCase {
    private readonly logger = createLogger(ListCodeReviewAutomationLabelsUseCase.name);
    constructor() {}

    execute(codeReviewVersion?: CodeReviewVersion) {
        try {
            return codeReviewVersion === CodeReviewVersion.v2 ? labelsDataV2 : labelsDataLegacy;
        } catch (error) {
            this.logger.error({
                message: 'Error listing code review automation labels',
                context: ListCodeReviewAutomationLabelsUseCase.name,
                error: error,
            });
            throw new Error('Error listing code review automation labels');
        }
    }
}
