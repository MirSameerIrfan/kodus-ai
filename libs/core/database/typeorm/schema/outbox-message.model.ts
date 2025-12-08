import { CoreModel } from '@libs/common/infrastructure/repositories/model/typeOrm';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { WorkflowJobModel } from './workflow-job.model';

@Entity('outbox_messages', { schema: 'workflow' })
@Index('IDX_outbox_messages_unprocessed', ['processed', 'createdAt'], {
    where: 'processed = FALSE',
    concurrent: true,
})
@Index('IDX_outbox_messages_job', ['job'], { concurrent: true })
export class OutboxMessageModel extends CoreModel {
    @ManyToOne(() => WorkflowJobModel)
    @JoinColumn({ name: 'jobId', referencedColumnName: 'uuid' })
    job: WorkflowJobModel;

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
