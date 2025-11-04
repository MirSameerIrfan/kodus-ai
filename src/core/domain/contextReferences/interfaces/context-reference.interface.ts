import type {
    ContextRequirement,
    ContextRevisionActor,
    ContextRevisionScope,
} from '@context-os-core/interfaces';

export interface IContextReference {
    uuid: string;
    parentReferenceId?: string;
    scope: ContextRevisionScope;
    entityType: string;
    entityId: string;
    requirements?: ContextRequirement[];
    knowledgeRefs?: Array<{ itemId: string; version?: string }>;
    origin?: ContextRevisionActor;
    createdAt?: Date;
    updatedAt?: Date;
    metadata?: Record<string, unknown>;
}
