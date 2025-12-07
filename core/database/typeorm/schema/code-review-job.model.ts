import { JobStatus } from '@/core/domain/workflowQueue/enums/job-status.enum';
import { ErrorClassification } from '@/core/domain/workflowQueue/enums/error-classification.enum';
import { PlatformType } from '@/shared/domain/enums/platform-type.enum';
import { CoreModel } from '@/shared/infrastructure/repositories/model/typeOrm';
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

@Entity('code_review_jobs')
@Index('IDX_code_review_jobs_status', ['status'], { concurrent: true })
@Index('IDX_code_review_jobs_org_team', ['organization', 'team'], {
    concurrent: true,
})
@Index('IDX_code_review_jobs_platform_repo', ['platformType', 'repositoryId'], {
    concurrent: true,
})
@Index(
    'IDX_code_review_jobs_pr_unique',
    ['platformType', 'repositoryId', 'pullRequestNumber'],
    {
        unique: true,
        concurrent: true,
    },
)
@Index('IDX_code_review_jobs_created_desc', { synchronize: false }) // DESC index created manually
export class CodeReviewJobModel extends CoreModel {
    @Column({ type: 'uuid', unique: true })
    correlationId: string;

    @Column({
        type: 'enum',
        enum: PlatformType,
    })
    platformType: PlatformType;

    @Column()
    repositoryId: string;

    @Column()
    repositoryName: string;

    @Column({ type: 'integer' })
    pullRequestNumber: number;

    @Column({ type: 'jsonb' })
    pullRequestData: Record<string, unknown>;

    @ManyToOne(() => OrganizationModel)
    @JoinColumn({ name: 'organization_id', referencedColumnName: 'uuid' })
    organization: OrganizationModel;

    @ManyToOne(() => TeamModel)
    @JoinColumn({ name: 'team_id', referencedColumnName: 'uuid' })
    team: TeamModel;

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

    @OneToMany(() => JobExecutionHistoryModel, (history) => history.job)
    executionHistory: JobExecutionHistoryModel[];
}
