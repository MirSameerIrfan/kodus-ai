import type {
    ContextRequirement,
    ContextRevisionActor,
    ContextRevisionScope,
} from '@context-os-core/interfaces';
import { ContextReferenceEntity } from '../entities/context-reference.entity';
import { IContextReferenceRepository } from './context-reference.repository.contract';

export const CONTEXT_REFERENCE_SERVICE_TOKEN = Symbol(
    'ContextReferenceService',
);

export interface IContextReferenceService extends IContextReferenceRepository {
    commitRevision(params: {
        scope: ContextRevisionScope;
        entityType: string;
        entityId: string;
        requirements?: ContextRequirement[];
        parentReferenceId?: string;
        uuid?: string;
        origin?: ContextRevisionActor;
        metadata?: Record<string, unknown>;
        knowledgeRefs?: Array<{ itemId: string; version?: string }>;
    }): Promise<{
        revision: ContextReferenceEntity;
        pointer: {
            uuid: string;
            requirementsHash?: string;
        };
    }>;

    getRevisionHistory(
        entityType: string,
        entityId: string,
        limit?: number,
    ): Promise<ContextReferenceEntity[]>;

    getLatestRevision(
        entityType: string,
        entityId: string,
    ): Promise<ContextReferenceEntity | undefined>;

    rollbackTo(params: {
        targetReferenceId: string;
        origin?: ContextRevisionActor;
    }): Promise<{
        revision: ContextReferenceEntity;
        pointer: {
            uuid: string;
            requirementsHash?: string;
        };
    }>;
}
