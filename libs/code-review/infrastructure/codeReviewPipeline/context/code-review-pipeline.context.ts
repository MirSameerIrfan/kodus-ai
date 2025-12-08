import {
    AnalysisContext,
    AutomaticReviewStatus,
    CodeReviewConfig,
    CodeSuggestion,
    CommentResult,
    FileChange,
    Repository,
} from '@shared/types/general/codeReview.type';
import { OrganizationAndTeamData } from '@shared/types/general/organizationAndTeamData';
import { AutomationExecutionEntity } from '@libs/automation/domain/entities/automation-execution.entity';
import { PlatformType } from '@shared/domain/enums/platform-type.enum';
import { TaskStatus } from '@libs/code-review/ee/ast/codeASTAnalysis.service';
import { ISuggestionByPR } from '@libs/code-review/domain/pull-requests/interfaces/pullRequests.interface';
import { IPullRequestMessages } from '@libs/code-review/domain/pr-messages/interfaces/pullRequestMessages.interface';
import { IClusterizedSuggestion } from '@libs/code-review/ee/fine-tuning/domain/interfaces/kodyFineTuning.interface';
import { IExternalPromptContext } from '@libs/code-review/domain/prompts/interfaces/promptExternalReference.interface';
import type {
    ContextLayer,
    ContextPack,
    ContextEvidence,
} from '@context-os-core/interfaces';
import type { ContextAugmentationsMap } from '@libs/code-review/infrastructure/context/code-review-context-pack.service';
import { PipelineContext } from '../../pipeline/interfaces/pipeline-context.interface';

export interface CodeReviewPipelineContext extends PipelineContext {
    workflowJobId?: string; // ID of the workflow job (for pausing/resuming)
    currentStage?: string; // Current stage being executed
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

/**
 * Serialize context to JSON string for persistence
 */
export function serializeContext(context: CodeReviewPipelineContext): string {
    // Convert Map to object for serialization
    const serializableContext = {
        ...context,
        fileMetadata: context.fileMetadata
            ? Object.fromEntries(context.fileMetadata)
            : undefined,
    };
    return JSON.stringify(serializableContext);
}

/**
 * Deserialize JSON string back to CodeReviewPipelineContext
 */
export function deserializeContext(data: string): CodeReviewPipelineContext {
    const parsed = JSON.parse(data);
    // Convert object back to Map
    if (parsed.fileMetadata) {
        parsed.fileMetadata = new Map(Object.entries(parsed.fileMetadata));
    }
    return parsed as CodeReviewPipelineContext;
}
