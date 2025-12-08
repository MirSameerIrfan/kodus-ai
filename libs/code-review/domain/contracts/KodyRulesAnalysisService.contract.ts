import {
    FileChangeContext,
    ReviewModeResponse,
    AnalysisContext,
    AIAnalysisResult,
    AIAnalysisResultPrLevel,
} from '@shared/types/general/codeReview.type';
import { OrganizationAndTeamData } from '@shared/types/general/organizationAndTeamData';

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
