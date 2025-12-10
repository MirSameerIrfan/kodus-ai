import type {
    ContextLayer,
    ContextPack,
    ContextEvidence,
} from '@context-os-core/interfaces';
import { AutomationExecutionEntity } from '@libs/automation/domain/automationExecution/entities/automation-execution.entity';
import { IPullRequestMessages } from '@libs/code-review/domain/pullRequestMessages/interfaces/pullRequestMessages.interface';
import { ISuggestionByPR } from '@libs/platformData/domain/pullRequests/interfaces/pullRequests.interface';
import { IClusterizedSuggestion } from '@libs/kodyFineTuning/domain/interfaces/kodyFineTuning.interface';
import { PlatformType } from '@libs/core/domain/enums';
import {
    AnalysisContext,
    AutomaticReviewStatus,
    CodeReviewConfig,
    CodeSuggestion,
    CommentResult,
    FileChange,
    Repository,
} from '@libs/core/infrastructure/config/types/general/codeReview.type';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { PipelineContext } from '@libs/core/infrastructure/pipeline/interfaces/pipeline-context.interface';
import { TaskStatus } from '@libs/ee/kodyAST/codeASTAnalysis.service';
import { IExternalPromptContext } from '@libs/ai-engine/domain/prompt/interfaces/promptExternalReference.interface';
import { ContextAugmentationsMap } from '@libs/ai-engine/infrastructure/adapters/services/context/code-review-context-pack.service';

export interface CodeReviewPipelineContext extends PipelineContext {
    dryRun: {
        enabled: boolean;
        id?: string;
    };
    organizationAndTeamData: OrganizationAndTeamData;
    repository: Repository;
    branch: string;
    pullRequest: {
        number: number;
        title: string;
        base: {
            repo: {
                fullName: string;
            };
            ref: string;
        };
        repository: Repository;
        isDraft: boolean;
        tags?: string[];
        stats: {
            total_additions: number;
            total_deletions: number;
            total_files: number;
            total_lines_changed: number;
        };
        [key: string]: any;
    };
    teamAutomationId: string;
    origin: string;
    action: string;
    platformType: PlatformType;
    triggerCommentId?: number | string;

    codeReviewConfig?: CodeReviewConfig;
    automaticReviewStatus?: AutomaticReviewStatus;

    changedFiles?: FileChange[];
    lastExecution?: {
        commentId?: any;
        noteId?: any;
        threadId?: any;
        lastAnalyzedCommit?: any;
    };
    pipelineMetadata?: {
        lastExecution?: AutomationExecutionEntity;
    };

    initialCommentData?: {
        commentId: number;
        noteId: number;
        threadId?: number;
    };

    pullRequestMessagesConfig?: IPullRequestMessages;

    batches: FileChange[][];

    clusterizedSuggestions?: IClusterizedSuggestion[];

    preparedFileContexts: AnalysisContext[];

    fileAnalysisResults?: Array<{
        validSuggestionsToAnalyze: Partial<CodeSuggestion>[];
        discardedSuggestionsBySafeGuard: Partial<CodeSuggestion>[];
        file: FileChange;
    }>;

    prAnalysisResults?: {
        validSuggestionsByPR?: ISuggestionByPR[];
        validCrossFileSuggestions?: CodeSuggestion[];
    };

    validSuggestions: Partial<CodeSuggestion>[];
    discardedSuggestions: Partial<CodeSuggestion>[];
    lastAnalyzedCommit?: any;

    validSuggestionsByPR?: ISuggestionByPR[];
    validCrossFileSuggestions?: CodeSuggestion[];

    lineComments?: CommentResult[];

    tasks?: {
        astAnalysis?: {
            taskId: string;
            status?: TaskStatus;
        };
    };
    // Resultados dos comentários de nível de PR
    prLevelCommentResults?: Array<CommentResult>;

    // Metadados dos arquivos processados (reviewMode, codeReviewModelUsed, etc.)
    fileMetadata?: Map<string, any>;

    /** Bloco com conteúdos de arquivos externos referenciados pelos prompts. */
    externalPromptContext?: IExternalPromptContext;
    /** Camadas já formatadas para incluir no ContextPack (ex.: arquivos, instruções). */
    externalPromptLayers?: ContextLayer[];

    /** ContextPack compartilhado entre os stages (instruções + camadas externas). */
    sharedContextPack?: ContextPack;
    /** Augmentations geradas dinamicamente durante o pipeline, mapeadas por nome de arquivo. */
    augmentationsByFile?: Record<string, ContextAugmentationsMap>;

    fileContextMap?: Record<string, FileContextAgentResult>;

    correlationId: string;
}

export interface FileContextAgentResult {
    sandboxEvidences?: ContextEvidence[];
    resolvedPromptOverrides?: CodeReviewConfig['v2PromptOverrides'];
}
