import { PipelineContext } from '@libs/core/infrastructure/pipeline/interfaces/pipeline-context.interface';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import {
    CodeReviewConfig,
    FileChange,
    CodeSuggestion,
} from '@libs/core/infrastructure/config/types/general/codeReview.type';
import { CliReviewResponse } from '@libs/cli-review/domain/types/cli-review.types';

/**
 * Pipeline context for CLI code review
 * Contains all data needed throughout the pipeline execution
 */
export interface CliReviewPipelineContext extends PipelineContext {
    // Input context
    organizationAndTeamData: OrganizationAndTeamData;
    codeReviewConfig: CodeReviewConfig;
    changedFiles: FileChange[];
    isFastMode: boolean;
    isTrialMode: boolean;
    startTime: number;
    correlationId: string;

    // Processing results
    validSuggestions: Partial<CodeSuggestion>[];
    discardedSuggestions: Partial<CodeSuggestion>[];
    fileMetadata?: Map<string, any>;

    // Stages may add these during execution
    batches?: FileChange[][];
    preparedFileContexts?: any[];

    // Output
    cliResponse?: CliReviewResponse;

    // Required by PipelineContext
    pipelineVersion: string;
    errors: any[];
}
