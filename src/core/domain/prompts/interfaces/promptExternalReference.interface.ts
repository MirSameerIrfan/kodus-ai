export enum PromptSourceType {
    CUSTOM_INSTRUCTION = 'custom_instruction',
    CATEGORY_BUG = 'category_bug',
    CATEGORY_PERFORMANCE = 'category_performance',
    CATEGORY_SECURITY = 'category_security',
    SEVERITY_CRITICAL = 'severity_critical',
    SEVERITY_HIGH = 'severity_high',
    SEVERITY_MEDIUM = 'severity_medium',
    SEVERITY_LOW = 'severity_low',
    GENERATION_MAIN = 'generation_main',
    KODY_RULE = 'kody_rule',
}

export enum PromptProcessingStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

export enum PromptReferenceErrorType {
    FILE_NOT_FOUND = 'file_not_found',
    REPO_ACCESS_DENIED = 'repo_access_denied',
    DETECTION_FAILED = 'detection_failed',
    INVALID_FORMAT = 'invalid_format',
    FILE_TOO_LARGE = 'file_too_large',
    FETCH_FAILED = 'fetch_failed',
}

export interface IFileReferenceError {
    type: PromptReferenceErrorType;
    message: string;
    attemptedPatterns: string[];
    timestamp: Date;
}

export interface IFileReference {
    filePath: string;
    lineRange?: {
        start: number;
        end: number;
    };
    repositoryName?: string;
    description?: string;
    originalText?: string;
    lastContentHash: string;
    lastValidatedAt: Date;
    estimatedTokens?: number;
    lastFetchError?: IFileReferenceError;
}

export interface IPromptReferenceSyncError {
    type: PromptReferenceErrorType;
    message: string;
    details: {
        fileName?: string;
        repositoryName?: string;
        attemptedPaths?: string[];
        timestamp?: Date;
    };
}

export interface IPromptExternalReference {
    uuid?: string;
    configKey: string;
    sourceType: PromptSourceType;
    organizationId: string;
    repositoryId: string;
    directoryId?: string;
    kodyRuleId?: string;
    repositoryName: string;
    promptHash: string;
    references: IFileReference[];
    syncErrors?: IPromptReferenceSyncError[];
    processingStatus: PromptProcessingStatus;
    lastProcessedAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ILoadedFileReference extends IFileReference {
    content: string;
}

export interface IExternalPromptContext {
    customInstructions?: {
        references: ILoadedFileReference[];
        error?: string;
    };
    categories?: {
        bug?: { references: ILoadedFileReference[]; error?: string };
        performance?: { references: ILoadedFileReference[]; error?: string };
        security?: { references: ILoadedFileReference[]; error?: string };
    };
    severity?: {
        critical?: { references: ILoadedFileReference[]; error?: string };
        high?: { references: ILoadedFileReference[]; error?: string };
        medium?: { references: ILoadedFileReference[]; error?: string };
        low?: { references: ILoadedFileReference[]; error?: string };
    };
    generation?: {
        main?: { references: ILoadedFileReference[]; error?: string };
    };
}

export interface IDetectedReference {
    fileName: string;
    filePattern?: string;
    description?: string;
    repositoryName?: string;
    originalText?: string;
    lineRange?: {
        start: number;
        end: number;
    };
}

