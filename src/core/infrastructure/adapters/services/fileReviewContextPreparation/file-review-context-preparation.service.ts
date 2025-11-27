import { createLogger } from '@kodus/flow';
/**
 * @license
 * © Kodus Tech. All rights reserved.
 */

import {
    FileChange,
    ReviewModeResponse,
} from '@/config/types/general/codeReview.type';
import { TaskStatus } from '@/ee/kodyAST/codeASTAnalysis.service';
import { ReviewModeOptions } from '@/shared/interfaces/file-review-context-preparation.interface';
import { BYOKConfig } from '@kodus/kodus-common/llm';
import { Injectable } from '@nestjs/common';
import { BaseFileReviewContextPreparation } from './base-file-review-context-preparation.service';

@Injectable()
export class FileReviewContextPreparation extends BaseFileReviewContextPreparation {
    protected readonly logger = createLogger(FileReviewContextPreparation.name);
    constructor() {
        super();
    }

    protected async determineReviewMode(
        options?: ReviewModeOptions,
        byokConfig?: BYOKConfig,
    ): Promise<ReviewModeResponse> {
        return ReviewModeResponse.LIGHT_MODE;
    }

    protected getRelevantFileContent(file: FileChange): Promise<{
        relevantContent: string | null;
        taskStatus?: TaskStatus;
        hasRelevantContent?: boolean;
    }> {
        // In the standard version, we return the file content directly
        // without any additional processing
        return Promise.resolve({
            relevantContent: file.content || null,
            hasRelevantContent: false,
            taskStatus: TaskStatus.TASK_STATUS_FAILED,
        });
    }
}
