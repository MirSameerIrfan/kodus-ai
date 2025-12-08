import { JobStatus } from '@libs/workflow-queue/domain/enums/job-status.enum';
import { ErrorClassification } from '@libs/workflow-queue/domain/enums/error-classification.enum';
import { WorkflowType } from '@libs/workflow-queue/domain/enums/workflow-type.enum';
import { HandlerType } from '@libs/workflow-queue/domain/enums/handler-type.enum';
import { CoreModel } from '@shared/infrastructure/repositories/model/typeOrm';
import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
} from 'typeorm';
import { OrganizationModel } from './organization.model';
import { TeamModel } from './team.model';
import { JobExecutionHistoryModel } from './job-execution-history.model';

@Entity('workflow_jobs', { schema: 'workflow' })
@Index('IDX_workflow_jobs_status_scheduled', ['status', 'scheduledAt'], {
    concurrent: true,
})
@Index('IDX_workflow_jobs_type_status', ['workflowType', 'status'], {
    concurrent: true,
})
@Index('IDX_workflow_jobs_org_team', ['organization', 'team'], {
    concurrent: true,
})
@Index('IDX_workflow_jobs_correlation', ['correlationId'], {
    concurrent: true,
})
export class WorkflowJobModel extends CoreModel {
    @Column({ type: 'uuid', unique: true })
    correlationId: string;

    @Column({
        type: 'enum',
        enum: WorkflowType,
    })
    workflowType: WorkflowType;

    @Column({
        type: 'enum',
        enum: HandlerType,
    })
    handlerType: HandlerType;

    @Column({ type: 'jsonb' })
    payload: Record<string, unknown>;

    @ManyToOne(() => OrganizationModel)
    @JoinColumn({ name: 'organizationId', referencedColumnName: 'uuid' })
    organization: OrganizationModel;

    @ManyToOne(() => TeamModel, { nullable: true })
    @JoinColumn({ name: 'teamId', referencedColumnName: 'uuid' })
    team?: TeamModel;

    @Column({
        type: 'enum',
        enum: JobStatus,
        default: JobStatus.PENDING,
    })
    status: JobStatus;

    @Column({ type: 'integer', default: 0 })
    priority: number;

    @Column({ type: 'integer', default: 0 })
    retryCount: number;

    @Column({ type: 'integer', default: 3 })
    maxRetries: number;

    @Column({
        type: 'enum',
        enum: ErrorClassification,
        nullable: true,
    })
    errorClassification?: ErrorClassification;

    @Column({ type: 'text', nullable: true })
    lastError?: string;

    @Column({ type: 'timestamp', nullable: true })
    scheduledAt?: Date;

    @Column({ type: 'timestamp', nullable: true })
    startedAt?: Date;

    @Column({ type: 'timestamp', nullable: true })
    completedAt?: Date;

    @Column({ type: 'varchar', length: 255, nullable: true })
    currentStage?: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;

    @Column({ type: 'jsonb', nullable: true })
    waitingForEvent?: {
        eventType: string; // e.g., 'ast.task.completed'
        eventKey: string; // e.g., taskId
        timeout: number; // milliseconds
        pausedAt: Date;
    };

    @Column({ type: 'jsonb', nullable: true })
    pipelineState?: Record<string, unknown>;

    @OneToMany(() => JobExecutionHistoryModel, (history) => history.job)
    executionHistory: JobExecutionHistoryModel[];
}
