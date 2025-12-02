import { JobStatus } from '@/core/domain/workflowQueue/enums/job-status.enum';
import { ErrorClassification } from '@/core/domain/workflowQueue/enums/error-classification.enum';
import { CoreModel } from '@/shared/infrastructure/repositories/model/typeOrm';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CodeReviewJobModel } from './code-review-job.model';

@Entity('job_execution_history')
@Index('IDX_job_exec_history_job', ['job'], { concurrent: true })
@Index('IDX_job_exec_history_attempt', ['job', 'attemptNumber'], {
    concurrent: true,
})
export class JobExecutionHistoryModel extends CoreModel {
    @ManyToOne(() => CodeReviewJobModel, (job) => job.executionHistory)
    @JoinColumn({ name: 'job_id', referencedColumnName: 'uuid' })
    job: CodeReviewJobModel;

    @Column({ type: 'integer' })
    attemptNumber: number;

    @Column({
        type: 'enum',
        enum: JobStatus,
    })
    status: JobStatus;

    @Column({ type: 'timestamp' })
    startedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    completedAt?: Date;

    @Column({ type: 'integer', nullable: true })
    durationMs?: number;

    @Column({
        type: 'enum',
        enum: ErrorClassification,
        nullable: true,
    })
    errorType?: ErrorClassification;

    @Column({ type: 'text', nullable: true })
    errorMessage?: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;
}
