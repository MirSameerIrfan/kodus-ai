import {
    FileChangeContext,
    ReviewModeResponse,
    AnalysisContext,
    AIAnalysisResult,
    AIAnalysisResultPrLevel,
} from '@libs/core/domain/types/general/codeReview.type';
import { OrganizationAndTeamData } from '@libs/core/domain/types/general/organizationAndTeamData';

export interface IKodyRulesAnalysisService {
    analyzeCodeWithAI(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        fileContext: FileChangeContext,
        reviewModeResponse: ReviewModeResponse,
        context: AnalysisContext,
        suggestions?: AIAnalysisResult,
    ): Promise<AIAnalysisResult | AIAnalysisResultPrLevel>;
}
