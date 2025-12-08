import { CoreModel } from '@shared/infrastructure/repositories/model/typeOrm';
import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { WorkflowJobModel } from './workflow-job.model';

@Entity('inbox_messages', { schema: 'workflow' })
@Unique('UQ_inbox_messages_message_id', ['messageId'])
@Index('IDX_inbox_messages_job', ['job'], { concurrent: true })
export class InboxMessageModel extends CoreModel {
    @Column({ type: 'varchar', length: 255, unique: true })
    messageId: string;

    @ManyToOne(() => WorkflowJobModel)
    @JoinColumn({ name: 'jobId', referencedColumnName: 'uuid' })
    job: WorkflowJobModel;

    @Column({ type: 'boolean', default: false })
    processed: boolean;

    @Column({ type: 'timestamp', nullable: true })
    processedAt?: Date;
}
