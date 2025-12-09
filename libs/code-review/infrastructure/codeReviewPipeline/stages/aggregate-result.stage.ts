import { createLogger } from '@kodus/flow';
import { Injectable } from '@nestjs/common';

import { BaseStage } from './base/base-stage.abstract';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';

@Injectable()
export class AggregateResultsStage extends BaseStage {
    private readonly logger = createLogger(AggregateResultsStage.name);
    readonly name = 'AggregateResultsStage';
    readonly dependsOn: string[] = [
        'CreatePrLevelCommentsStage',
        'CreateFileCommentsStage',
    ]; // Depends on both comment stages

    constructor() {
        super();
    }

    async execute(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        if (
            !context.fileAnalysisResults ||
            context.fileAnalysisResults.length === 0
        ) {
            this.logger.warn({
                message: `No file analysis results to aggregate for PR#${context.pullRequest.number}`,
                context: this.name,
                metadata: {
                    organizationAndTeamData: context.organizationAndTeamData,
                    prNumber: context.pullRequest.number,
                },
            });
        } else {
            const validSuggestions = [];
            const discardedSuggestions = [];

            context.fileAnalysisResults?.forEach((result) => {
                if (result.validSuggestionsToAnalyze.length > 0) {
                    validSuggestions.push(...result.validSuggestionsToAnalyze);
                }
                if (result.discardedSuggestionsBySafeGuard.length > 0) {
                    discardedSuggestions.push(
                        ...result.discardedSuggestionsBySafeGuard,
                    );
                }
            });

            this.logger.log({
                message: `Aggregated ${validSuggestions.length} valid suggestions, ${discardedSuggestions.length} discarded suggestions`,
                context: this.name,
                metadata: {
                    organizationAndTeamData: context.organizationAndTeamData,
                    prNumber: context.pullRequest.number,
                },
            });

            context = this.updateContext(context, (draft) => {
                draft.validSuggestions = validSuggestions;
                draft.discardedSuggestions = discardedSuggestions;
            });
        }

        if (
            !context.prAnalysisResults ||
            (context.prAnalysisResults.validSuggestionsByPR?.length === 0 &&
                context.prAnalysisResults.validCrossFileSuggestions?.length ===
                    0)
        ) {
            this.logger.warn({
                message: `No valid suggestions to aggregate for PR#${context.pullRequest.number}`,
                context: this.name,
                metadata: {
                    organizationAndTeamData: context.organizationAndTeamData,
                    prNumber: context.pullRequest.number,
                },
            });
        } else {
            const validSuggestionsByPR = [];
            const validCrossFileSuggestions = [];

            if (
                context.prAnalysisResults?.validSuggestionsByPR &&
                context.prAnalysisResults.validSuggestionsByPR?.length > 0
            ) {
                validSuggestionsByPR.push(
                    ...context.prAnalysisResults.validSuggestionsByPR,
                );
            }

            if (
                context.prAnalysisResults?.validCrossFileSuggestions &&
                context.prAnalysisResults.validCrossFileSuggestions?.length > 0
            ) {
                validCrossFileSuggestions.push(
                    ...context.prAnalysisResults.validCrossFileSuggestions,
                );
            }

            this.logger.log({
                message: `Aggregated ${validSuggestionsByPR.length} valid suggestions by PR, ${validCrossFileSuggestions.length} valid cross-file suggestions`,
                context: this.name,
                metadata: {
                    organizationAndTeamData: context.organizationAndTeamData,
                    prNumber: context.pullRequest.number,
                },
            });

            context = this.updateContext(context, (draft) => {
                draft.validSuggestionsByPR = validSuggestionsByPR;
                draft.validCrossFileSuggestions = validCrossFileSuggestions;
            });
        }

        return context;
    }
}
