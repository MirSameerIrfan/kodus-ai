import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

import type {
    ContextRequirement,
    ContextRevisionActor,
    ContextRevisionScope,
} from '@context-os-core/interfaces.js';

@Entity('context_references')
export class ContextReferenceModel {
    @PrimaryColumn({ type: 'varchar', length: 64 })
    revisionId: string;

    @Column({ type: 'varchar', length: 64, nullable: true })
    parentRevisionId?: string;

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

    @CreateDateColumn({ type: 'timestamp with time zone' })
    createdAt: Date;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;
}
