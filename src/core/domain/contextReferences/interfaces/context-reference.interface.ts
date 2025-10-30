import type {
    ContextRequirement,
    ContextRevisionActor,
    ContextRevisionScope,
} from '@context-os-core/interfaces.js';

export interface IContextReference {
    uuid: string;
    parentReferenceId?: string;
    scope: ContextRevisionScope;
    entityType: string;
    entityId: string;
    payload: Record<string, unknown>;
    requirements?: ContextRequirement[];
    knowledgeRefs?: Array<{ itemId: string; version?: string }>;
    origin?: ContextRevisionActor;
    createdAt?: Date;
    updatedAt?: Date;
    metadata?: Record<string, unknown>;
}
