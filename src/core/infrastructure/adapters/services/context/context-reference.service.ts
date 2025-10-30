import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';
import {
    CONTEXT_REFERENCE_REPOSITORY_TOKEN,
    IContextReferenceRepository,
} from '@/core/domain/contextReferences/contracts/context-reference.repository.contract';
import { IContextReferenceService } from '@/core/domain/contextReferences/contracts/context-reference.service.contract';
import { ContextReferenceEntity } from '@/core/domain/contextReferences/entities/context-reference.entity';
import { IContextReference } from '@/core/domain/contextReferences/interfaces/context-reference.interface';
import {
    ContextRevisionScope,
    ContextRequirement,
    ContextRevisionActor,
} from '@context-os-core/interfaces.js';
import {
    createRevisionEntry,
    computeRequirementsHash,
} from '../../../../../../packages/context-os-core/src/utils/context-requirements.js';

@Injectable()
export class ContextReferenceService implements IContextReferenceService {
    constructor(
        @Inject(CONTEXT_REFERENCE_REPOSITORY_TOKEN)
        private readonly repository: IContextReferenceRepository,
    ) {}

    async commitRevision(params: {
        scope: ContextRevisionScope;
        entityType: string;
        entityId: string;
        payload?: Record<string, unknown>;
        requirements?: ContextRequirement[];
        parentReferenceId?: string;
        uuid?: string;
        origin?: ContextRevisionActor;
        metadata?: Record<string, unknown>;
        knowledgeRefs?: Array<{ itemId: string; version?: string }>;
    }): Promise<{
        revision: ContextReferenceEntity;
        pointer: { uuid: string; requirementsHash?: string };
    }> {
        const uuid = params.uuid ?? randomUUID();
        const origin: ContextRevisionActor =
            params.origin ?? { kind: 'system', id: 'unknown' };
        const payload = params.payload ?? {
            requirements: params.requirements ?? [],
        };

        const entry = createRevisionEntry({
            revisionId: uuid,
            parentRevisionId: params.parentReferenceId,
            scope: params.scope,
            entityType: params.entityType,
            entityId: params.entityId,
            origin,
            requirements: params.requirements,
            payload,
            metadata: params.metadata,
            knowledgeRefs: params.knowledgeRefs,
        });

        const contextReference: IContextReference = {
            uuid: entry.revisionId,
            parentReferenceId: entry.parentRevisionId,
            scope: entry.scope,
            entityType: entry.entityType,
            entityId: entry.entityId,
            payload: entry.payload,
            requirements: entry.requirements,
            knowledgeRefs: entry.knowledgeRefs,
            origin: entry.origin,
            metadata: entry.metadata,
        };

        const persisted = await this.repository.create(contextReference);
        if (!persisted) {
            throw new Error('Failed to persist context reference');
        }

        const requirementsHash =
            entry.requirements && entry.requirements.length
                ? computeRequirementsHash(entry.requirements)
                : undefined;

        return {
            revision: persisted,
            pointer: { uuid: persisted.uuid, requirementsHash },
        };
    }

    async getRevisionHistory(
        entityType: string,
        entityId: string,
        limit?: number,
    ): Promise<ContextReferenceEntity[]> {
        const results = await this.repository.find({ entityType, entityId });
        if (typeof limit === 'number' && limit >= 0) {
            return results.slice(0, limit);
        }
        return results;
    }

    async getLatestRevision(
        entityType: string,
        entityId: string,
    ): Promise<ContextReferenceEntity | undefined> {
        const [latest] = await this.getRevisionHistory(entityType, entityId, 1);
        return latest;
    }

    async rollbackTo(params: {
        targetReferenceId: string;
        origin?: ContextRevisionActor;
    }): Promise<{
        revision: ContextReferenceEntity;
        pointer: { uuid: string; requirementsHash?: string };
    }> {
        const target = await this.repository.findById(params.targetReferenceId);
        if (!target) {
            throw new Error(
                `Context reference ${params.targetReferenceId} not found`,
            );
        }

        const latest = await this.getLatestRevision(
            target.entityType,
            target.entityId,
        );

        return this.commitRevision({
            scope: target.scope,
            entityType: target.entityType,
            entityId: target.entityId,
            payload: target.payload,
            requirements: target.requirements,
            parentReferenceId: latest?.uuid,
            origin:
                params.origin ??
                target.origin ??
                ({ kind: 'system', id: 'rollback' } as ContextRevisionActor),
            metadata: target.metadata,
            knowledgeRefs: target.knowledgeRefs,
        });
    }

    async create(
        contextReference: IContextReference,
    ): Promise<ContextReferenceEntity | undefined> {
        return this.repository.create(contextReference);
    }

    async find(
        filter?: Partial<IContextReference>,
    ): Promise<ContextReferenceEntity[]> {
        return this.repository.find(filter);
    }

    async findOne(
        filter: Partial<IContextReference>,
    ): Promise<ContextReferenceEntity | undefined> {
        return this.repository.findOne(filter);
    }

    async findById(uuid: string): Promise<ContextReferenceEntity | undefined> {
        return this.repository.findById(uuid);
    }

    async update(
        filter: Partial<IContextReference>,
        data: Partial<IContextReference>,
    ): Promise<ContextReferenceEntity | undefined> {
        return this.repository.update(filter, data);
    }

    async delete(uuid: string): Promise<void> {
        return this.repository.delete(uuid);
    }
}
