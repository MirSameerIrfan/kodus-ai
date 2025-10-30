import { Column, Entity } from 'typeorm';

import type {
    ContextRequirement,
    ContextRevisionActor,
    ContextRevisionScope,
} from '@context-os-core/interfaces.js';
import { CoreModel } from '@/shared/infrastructure/repositories/model/typeOrm';

@Entity('context_references')
export class ContextReferenceModel extends CoreModel {
    @Column({ type: 'varchar', length: 64, nullable: true })
    parentReferenceId?: string;

    @Column({ type: 'jsonb' })
    scope: ContextRevisionScope;

    @Column({ type: 'varchar', length: 128 })
    entityType: string;

    @Column({ type: 'varchar', length: 256 })
    entityId: string;

    @Column({ type: 'jsonb' })
    payload: Record<string, unknown>;

    @Column({ type: 'jsonb', nullable: true })
    requirements?: ContextRequirement[];

    @Column({ type: 'jsonb', nullable: true })
    knowledgeRefs?: Array<{ itemId: string; version?: string }>;

    @Column({ type: 'jsonb', nullable: true })
    origin?: ContextRevisionActor;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;
}
