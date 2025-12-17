import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';

import { CoreModel } from '@libs/core/infrastructure/repositories/model/typeOrm';
import { WorkflowJobModel } from './workflow-job.model';

@Entity({ name: 'inbox_messages', schema: 'workflow' })
@Index('IDX_inbox_messages_message_id', ['messageId'], { unique: true })
@Index('IDX_inbox_messages_consumer_message', ['consumerId', 'messageId'], {
    unique: true,
})
export class InboxMessageModel extends CoreModel {
    @Column({ type: 'varchar', length: 255 })
    messageId: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    consumerId?: string;

    @ManyToOne(() => WorkflowJobModel, (job) => job.inboxMessages, {
        nullable: true,
    })
    @JoinColumn({ name: 'job_id', referencedColumnName: 'uuid' })
    job?: WorkflowJobModel;

    @Column({ type: 'boolean', default: false })
    processed: boolean;

    @Column({ type: 'timestamp', nullable: true })
    processedAt?: Date;
}
