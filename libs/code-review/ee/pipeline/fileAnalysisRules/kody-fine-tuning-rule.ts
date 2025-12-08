// /**
//  * @license
//  * Kodus Tech. All rights reserved.
//  */
// import { Injectable } from '@nestjs/common';
// import { AnalysisContext } from '@libs/common/types/general/codeReview.type';
// import { FileChange } from '@libs/common/types/general/codeReview.type';
// import { CodeSuggestion } from '@libs/common/types/general/codeReview.type';
// import { IClusterizedSuggestion } from '@libs/code-review/ee/fine-tuning/domain/interfaces/kodyFineTuning.interface';
// import { KodyFineTuningService } from '@libs/code-review/ee/fine-tuning/infrastructure/kodyFineTuning.service';
// import { SuggestionService } from '@libs/code-review/infrastructure/suggestion.service';

// @Injectable()
// export class KodyFineTuningRule extends BaseFileAnalysisRule {
//     constructor(
//         private readonly kodyFineTuningService: KodyFineTuningService,
//         private readonly suggestionService: SuggestionService,
//     ) {
//         super();
//     }

//     isEnabled(context: AnalysisContext): boolean {
//         return context?.codeReviewConfig?.kodyFineTuningConfig?.enabled;
//     }

//     async analyzeFiles(
//         files: FileChange[],
//         context: AnalysisContext,
//         suggestions: CodeSuggestion[],
//         clusterizedSuggestions: IClusterizedSuggestion[],
//     ): Promise<{
//         validSuggestions: CodeSuggestion[];
//         discardedSuggestions: CodeSuggestion[];
//         overallComments: { filepath: string; summary: string }[];
//     }> {
//         const clusteredSuggestions = await this.kodyFineTuningService.fineTuningAnalysis(
//             context?.organizationAndTeamData.organizationId,
//             context?.pullRequest?.number,
//             context?.pullRequest?.repository,
//             suggestions,
//             clusterizedSuggestions,
//         );

//         const discardedSuggestions = await this.suggestionService.getDiscardedSuggestions(
//             suggestions,
//             clusteredSuggestions,
//             PriorityStatus.DISCARDED_BY_KODY_FINE_TUNING,
//         );

//         return {
//             validSuggestions: clusteredSuggestions,
//             discardedSuggestions,
//             overallComments: [],
//         };
//     }
// }
