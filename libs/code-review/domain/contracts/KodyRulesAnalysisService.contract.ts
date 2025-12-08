import {
    FileChangeContext,
    ReviewModeResponse,
    AnalysisContext,
    AIAnalysisResult,
    AIAnalysisResultPrLevel,
} from '@libs/common/types/general/codeReview.type';
import { OrganizationAndTeamData } from '@libs/common/types/general/organizationAndTeamData';

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
