import { Column, Entity, Index } from 'typeorm';

import { CoreModel } from '@libs/core/infrastructure/repositories/model/typeOrm';


@Entity({ name: 'outbox_messages', schema: 'workflow' })
@Index('IDX_outbox_messages_processed', ['processed'])
@Index('IDX_outbox_messages_created_at', ['createdAt'])
export class OutboxMessageModel extends CoreModel {
    /*
    @ManyToOne(() => WorkflowJobModel, (job) => job.outboxMessages, {
        nullable: true,
    })
    @JoinColumn({ name: 'job_id', referencedColumnName: 'uuid' })
    job?: WorkflowJobModel;
    */

    @Column({ type: 'varchar', length: 255 })
    exchange: string;

    @Column({ type: 'varchar', length: 255 })
    routingKey: string;

    @Column({ type: 'jsonb' })
    payload: Record<string, unknown>;

    @Column({ type: 'boolean', default: false })
    processed: boolean;

    @Column({ type: 'timestamp', nullable: true })
    processedAt?: Date;
}
