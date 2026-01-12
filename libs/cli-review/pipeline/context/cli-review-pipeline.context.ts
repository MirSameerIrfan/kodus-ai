import { CodeReviewPipelineContext } from '@libs/code-review/pipeline/context/code-review-pipeline.context';
import { CliReviewResponse } from '@libs/cli-review/domain/types/cli-review.types';

/**
 * Pipeline context for CLI code review
 * Extends CodeReviewPipelineContext to reuse existing stages
 * PR-specific fields are populated with dummy values
 */
export interface CliReviewPipelineContext extends CodeReviewPipelineContext {
    // CLI-specific fields
    isFastMode: boolean;
    isTrialMode: boolean;
    startTime: number;
    correlationId: string;
    cliResponse?: CliReviewResponse;
}
