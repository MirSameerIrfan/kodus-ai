import { FileChange } from '@libs/common/types/general/codeReview.type';
import { Commit } from '@libs/common/types/general/commit.type';
import { OrganizationAndTeamData } from '@libs/common/types/general/organizationAndTeamData';
import { PullRequestAuthor } from '@libs/platform/domain/types/codeManagement/pullRequests.type';

export const PULL_REQUEST_MANAGER_SERVICE_TOKEN = Symbol(
    'PullRequestManagerService',
);

export interface IPullRequestManagerService {
    getPullRequestDetails(
        organizationAndTeamData: OrganizationAndTeamData,
        repository: { name: string; id: any },
        prNumber: number,
    ): Promise<any>;

    getChangedFiles(
        organizationAndTeamData: OrganizationAndTeamData,
        repository: { name: string; id: any },
        pullRequest: any,
        ignorePaths: string[],
        lastCommit?: string,
    ): Promise<FileChange[]>;

    getPullRequestAuthorsWithCache(
        organizationAndTeamData: OrganizationAndTeamData,
        determineBots?: boolean,
    ): Promise<PullRequestAuthor[]>;

    getNewCommitsSinceLastExecution(
        organizationAndTeamData: OrganizationAndTeamData,
        repository: { name: string; id: any },
        pullRequest: any,
        lastCommit?: string,
    ): Promise<Commit[]>;
}
