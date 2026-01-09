import { ValidateCodeSemanticsResult } from '@libs/common/utils/langchainCommon/prompts/validateCodeSemantics';
import {
    AIAnalysisResult,
    AnalysisContext,
    ReviewModeResponse,
} from '@libs/core/infrastructure/config/types/general/codeReview.type';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import {
    GetImpactAnalysisResponse,
    GetTaskInfoResponse,
    InitializeImpactAnalysisResponse,
    InitializeRepositoryResponse,
} from '@libs/ee/kodyAST/interfaces/code-ast-analysis.interface';
import {
    ASTValidateCodeRequest,
    ASTValidateCodeResponse,
} from '../types/astValidate.type';

export const AST_ANALYSIS_SERVICE_TOKEN = Symbol.for('ASTAnalysisService');

export interface IASTAnalysisService {
    awaitTask(
        taskId: string,
        organizationAndTeamData: OrganizationAndTeamData,
        options?: {
            timeout?: number;
            initialInterval?: number;
            maxInterval?: number;
            useExponentialBackoff?: boolean;
        },
    ): Promise<GetTaskInfoResponse>;
    analyzeASTWithAI(
        context: AnalysisContext,
        reviewModeResponse: ReviewModeResponse,
    ): Promise<AIAnalysisResult>;
    initializeASTAnalysis(
        repository: any,
        pullRequest: any,
        platformType: string,
        organizationAndTeamData: OrganizationAndTeamData,
        filePaths?: string[],
    ): Promise<InitializeRepositoryResponse>;
    deleteASTAnalysis(
        repository: any,
        pullRequest: any,
        platformType: string,
        organizationAndTeamData: OrganizationAndTeamData,
        taskId: string,
    ): Promise<void>;
    initializeImpactAnalysis(
        repository: any,
        pullRequest: any,
        platformType: string,
        organizationAndTeamData: OrganizationAndTeamData,
        codeChunk: string,
        fileName: string,
        graphsTaskId: string,
    ): Promise<InitializeImpactAnalysisResponse>;
    getImpactAnalysis(
        repository: any,
        pullRequest: any,
        platformType: string,
        organizationAndTeamData: any,
        taskId: string,
    ): Promise<GetImpactAnalysisResponse>;
    getRelatedContentFromDiff(
        repository: any,
        pullRequest: any,
        platformType: string,
        organizationAndTeamData: OrganizationAndTeamData,
        diff: string,
        filePath: string,
        taskId: string,
    ): Promise<{ content: string }>;
    startValidate(payload: {
        files: ASTValidateCodeRequest;
    }): Promise<{ taskId: string }>;
    getValidate(taskId: string): Promise<ASTValidateCodeResponse>;
    validateWithLLM(
        taskId: string,
        payload: {
            code: string;
            filePath: string;
            language?: string;
            diff?: string;
        },
    ): Promise<ValidateCodeSemanticsResult | null>;
    test(payload: any): Promise<any>;
    getTest(id: string): Promise<any>;
}
