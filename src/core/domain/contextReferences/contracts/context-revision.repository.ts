import type {
    ContextRequirement,
    ContextRevisionActor,
    ContextRevisionLogEntry,
    ContextRevisionScope,
} from '@context-os-core/interfaces.js';

export const CONTEXT_REFERENCE_REPOSITORY_TOKEN = Symbol(
    'ContextReferenceRepository',
);

export interface CreateContextRevisionParams {
    revisionId: string;
    parentRevisionId?: string;
    scope: ContextRevisionScope;
    entityType: string;
    entityId: string;
    payload: Record<string, unknown>;
    requirements?: ContextRequirement[];
    knowledgeRefs?: Array<{ itemId: string; version?: string }>;
    origin?: ContextRevisionActor;
    metadata?: Record<string, unknown>;
}

export interface ContextRevisionFilter {
    scope?: ContextRevisionScope;
    entityType?: string;
    entityId?: string;
    revisionId?: string;
}

export interface ContextRevisionHistoryQuery {
    entityType: string;
    entityId: string;
    scope?: ContextRevisionScope;
    limit?: number;
    offset?: number;
}

export interface IContextReferenceRepository {
    createRevision(
        params: CreateContextRevisionParams,
    ): Promise<ContextRevisionLogEntry>;

    getRevision(revisionId: string): Promise<ContextRevisionLogEntry | null>;

    getRevisionHistory(
        query: ContextRevisionHistoryQuery,
    ): Promise<ContextRevisionLogEntry[]>;

    deleteRevision(revisionId: string): Promise<void>;

    getLatestRevision(
        filter: ContextRevisionFilter,
    ): Promise<ContextRevisionLogEntry | null>;
}
