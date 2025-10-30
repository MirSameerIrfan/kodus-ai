import { Inject, Injectable } from '@nestjs/common';
import {
    ContextRevisionHistoryQuery,
    ContextRevisionFilter,
    CONTEXT_REFERENCE_REPOSITORY_TOKEN,
    IContextReferenceRepository,
} from '@/core/domain/contextReferences/contracts/context-revision.repository';
import type {
    ContextRequirement,
    ContextRevisionActor,
    ContextRevisionLogEntry,
    ContextRevisionScope,
} from '@context-os-core/interfaces.js';
import {
    createRevisionEntry,
    computeRequirementsHash,
} from '@context-os-core/utils/context-requirements.js';

interface CommitRevisionInput {
    scope: ContextRevisionScope;
    entityType: string;
    entityId: string;
    requirements?: ContextRequirement[];
    payload?: Record<string, unknown>;
    parentRevisionId?: string;
    revisionId?: string;
    origin?: ContextRevisionActor;
    metadata?: Record<string, unknown>;
    knowledgeRefs?: Array<{ itemId: string; version?: string }>;
}

interface CommitResult {
    revision: ContextRevisionLogEntry;
    pointer: {
        revisionId: string;
        requirementsHash?: string;
    };
}

function generateRevisionId(): string {
    const iso = new Date().toISOString();
    return `rev_${iso.replace(/[-:]/g, '').replace('.', '').replace('Z', 'Z')}`;
}

@Injectable()
export class ContextReferenceService {
    constructor(
        @Inject(CONTEXT_REFERENCE_REPOSITORY_TOKEN)
        private readonly repository: IContextReferenceRepository,
    ) {}

    async commitRevision(input: CommitRevisionInput): Promise<CommitResult> {
        const revisionId = input.revisionId ?? generateRevisionId();
        const origin: ContextRevisionActor =
            input.origin ?? { kind: 'system', id: 'unknown' };
        const payload = input.payload ?? {
            requirements: input.requirements ?? [],
        };

        const entry = createRevisionEntry({
            revisionId,
            parentRevisionId: input.parentRevisionId,
            scope: input.scope,
            entityType: input.entityType,
            entityId: input.entityId,
            origin,
            requirements: input.requirements,
            payload,
            metadata: input.metadata,
            knowledgeRefs: input.knowledgeRefs,
        });
        const requirementsHash =
            entry.requirements && entry.requirements.length > 0
                ? computeRequirementsHash(entry.requirements)
                : undefined;

        const persisted = await this.repository.createRevision({
            revisionId: entry.revisionId,
            parentRevisionId: entry.parentRevisionId,
            scope: entry.scope,
            entityType: entry.entityType,
            entityId: entry.entityId,
            payload: entry.payload,
            requirements: entry.requirements,
            knowledgeRefs: entry.knowledgeRefs,
            origin: entry.origin,
            metadata: entry.metadata,
        });

        return {
            revision: persisted,
            pointer: {
                revisionId: persisted.revisionId,
                requirementsHash,
            },
        };
    }

    async getRevision(
        revisionId: string,
    ): Promise<ContextRevisionLogEntry | null> {
        return this.repository.getRevision(revisionId);
    }

    async getRevisionHistory(query: ContextRevisionHistoryQuery): Promise<ContextRevisionLogEntry[]> {
        return this.repository.getRevisionHistory(query);
    }

    async getLatestRevision(
        filter: ContextRevisionFilter,
    ): Promise<ContextRevisionLogEntry | null> {
        return this.repository.getLatestRevision(filter);
    }

    async rollbackTo(params: {
        targetRevisionId: string;
        origin?: ContextRevisionActor;
    }): Promise<CommitResult> {
        const target = await this.repository.getRevision(params.targetRevisionId);
        if (!target) {
            throw new Error(`Revision ${params.targetRevisionId} not found`);
        }

        const latest = await this.repository.getLatestRevision({
            entityType: target.entityType,
            entityId: target.entityId,
        });

        return this.commitRevision({
            scope: target.scope,
            entityType: target.entityType,
            entityId: target.entityId,
            requirements: target.requirements,
            payload: target.payload,
            parentRevisionId: latest?.revisionId,
            origin:
                params.origin ??
                target.origin ??
                ({ kind: 'system', id: 'rollback' } as ContextRevisionActor),
            metadata: target.metadata,
            knowledgeRefs: target.knowledgeRefs,
        });
    }

    static applyRevisionPointer<T extends { contextRevisionId?: string; contextRequirementsHash?: string }>(
        config: T,
        pointer: { revisionId: string; requirementsHash?: string },
    ): T {
        return {
            ...config,
            contextRevisionId: pointer.revisionId,
            contextRequirementsHash: pointer.requirementsHash ?? undefined,
        };
    }

    static computeHash(requirements: ContextRequirement[]): string {
        return computeRequirementsHash(requirements);
    }
}
