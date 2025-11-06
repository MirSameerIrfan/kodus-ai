import { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
import { DryRunEntity } from '../entities/dryRun.entity';
import { DryRunStatus, IDryRun } from '../interfaces/dryRun.interface';
import { IDryRunRepository } from './dryRun.repository.contract';
import { CodeReviewConfig } from '@/config/types/general/codeReview.type';
import {
    IFile,
    IPullRequests,
} from '../../pullRequests/interfaces/pullRequests.interface';
import { IPullRequestMessages } from '../../pullRequestMessages/interfaces/pullRequestMessages.interface';
import { SeverityLevel } from '@/shared/utils/enums/severityLevel.enum';

export const DRY_RUN_SERVICE_TOKEN = Symbol('DRY_RUN_SERVICE_TOKEN');

export interface IDryRunService extends IDryRunRepository {
    findById(id: string): Promise<DryRunEntity | null>;

    findDryRunById(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        id: string;
    }): Promise<IDryRun['runs'][number] | null>;

    addDryRun(params: {
        id?: string;
        organizationAndTeamData: OrganizationAndTeamData;
        config: CodeReviewConfig;
        pullRequestMessagesConfig: IPullRequestMessages | null;
        provider: IPullRequests['provider'];
        prNumber: number;
        files?: Partial<IFile>[];
        prLevelSuggestions?: Partial<
            IPullRequests['prLevelSuggestions'][number]
        >[];
        repositoryId: string;
        repositoryName: string;
        directoryId?: string;
    }): Promise<IDryRun['runs'][number]>;

    addMessageToDryRun(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        id: string;
        content: string;
        path?: string;
        lines?: {
            start: number;
            end: number;
        };
        severity?: string;
        category?: string;
        codeBlock?: string;
    }): Promise<IDryRun['runs'][number] | null>;

    updateMessageInDryRun(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        id: string;
        commentId: number;
        content: string;
    }): Promise<IDryRun['runs'][number] | null>;

    updateDescriptionInDryRun(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        id: string;
        description: string;
    }): Promise<IDryRun['runs'][number] | null>;

    updateDryRunStatus(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        id: string;
        status: DryRunStatus;
    }): Promise<IDryRun['runs'][number] | null>;

    removeDryRunByHash(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        id: string;
    }): Promise<IDryRun | null>;

    clearDryRuns(params: {
        organizationAndTeamData: OrganizationAndTeamData;
    }): Promise<void>;
}
