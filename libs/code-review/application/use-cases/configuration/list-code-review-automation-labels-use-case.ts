import { Injectable } from '@nestjs/common';

import { createLogger } from '@kodus/flow';
import labelsDataLegacy from '@libs/automation/infrastructure/adapters/services/processAutomation/config/codeReview/labelsCodeReview_legacy.json';
import labelsDataV2 from '@libs/automation/infrastructure/adapters/services/processAutomation/config/codeReview/labelsCodeReview_v2.json';
import { CodeReviewVersion } from '@libs/core/infrastructure/config/types/general/codeReview.type';

@Injectable()
export class ListCodeReviewAutomationLabelsUseCase {
    private readonly logger = createLogger(
        ListCodeReviewAutomationLabelsUseCase.name,
    );
    constructor() {}

    execute(codeReviewVersion?: CodeReviewVersion) {
        try {
            return codeReviewVersion === CodeReviewVersion.v2
                ? labelsDataV2
                : labelsDataLegacy;
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
