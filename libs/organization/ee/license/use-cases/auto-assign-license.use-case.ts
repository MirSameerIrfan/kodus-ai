import { createLogger } from '@kodus/flow';
import { OrganizationAndTeamData } from '@libs/common/types/general/organizationAndTeamData';
import {
    IOrganizationParametersService,
    ORGANIZATION_PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/org-parameters/contracts/organizationParameters.service.contract';
import {
    IPullRequestsService,
    PULL_REQUESTS_SERVICE_TOKEN,
} from '@libs/code-review/domain/pull-requests/contracts/pullRequests.service.contracts';
import { OrganizationParametersKey } from '@libs/common/enums/organization-parameters-key.enum';
import { Inject, Injectable } from '@nestjs/common';
import {
    ILicenseService,
    LICENSE_SERVICE_TOKEN,
} from '../interfaces/license.interface';

@Injectable()
export class AutoAssignLicenseUseCase {
    private readonly logger = createLogger(AutoAssignLicenseUseCase.name);
    constructor(
        @Inject(ORGANIZATION_PARAMETERS_SERVICE_TOKEN)
        private readonly organizationParametersService: IOrganizationParametersService,
        @Inject(LICENSE_SERVICE_TOKEN)
        private readonly licenseService: ILicenseService,
        @Inject(PULL_REQUESTS_SERVICE_TOKEN)
        private readonly pullRequestsService: IPullRequestsService,
    ) {}

    async execute(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        userGitId: string;
        prNumber: number;
        repositoryName: string;
        provider: string;
    }): Promise<{
        shouldProceed: boolean;
        reason:
            | 'FREEBIE'
            | 'ASSIGNED'
            | 'ALREADY_LICENSED'
            | 'ASSIGNMENT_FAILED'
            | 'AUTO_ASSIGN_DISABLED'
            | 'NOT_ENOUGH_PRS'
            | 'IGNORED_USER';
    }> {
        const { organizationAndTeamData, userGitId, provider } = params;

        try {
            // 1. Check if Auto License Assignment is enabled
            const config = await this.organizationParametersService.findByKey(
                OrganizationParametersKey.AUTO_LICENSE_ASSIGNMENT,
                organizationAndTeamData,
            );

            if (!config?.configValue?.enabled) {
                return { shouldProceed: false, reason: 'AUTO_ASSIGN_DISABLED' };
            }

            // 2. Check if user already has a license (double check)
            const usersWithLicense =
                await this.licenseService.getAllUsersWithLicense(
                    organizationAndTeamData,
                );
            const hasLicense = usersWithLicense.some(
                (u) => u.git_id === userGitId,
            );

            if (hasLicense) {
                return { shouldProceed: true, reason: 'ALREADY_LICENSED' };
            }

            // 3. Check if user is ignored
            if (config?.configValue?.ignoredUsers?.length > 0) {
                if (config?.configValue?.ignoredUsers.includes(userGitId)) {
                    return { shouldProceed: false, reason: 'IGNORED_USER' };
                }
            }

            // 4. Count user's PRs
            const prs = await this.pullRequestsService.find({
                'organizationId': organizationAndTeamData.organizationId,
                'user.id': userGitId,
            } as any);

            // If it's the first PR, it's a freebie
            if ((prs?.length ?? 0) <= 1) {
                return { shouldProceed: true, reason: 'FREEBIE' };
            }

            // 5. If user has 2 or more PRs, assign license
            this.logger.log({
                message: `Auto-assigning license to user ${userGitId}`,
                context: AutoAssignLicenseUseCase.name,
                metadata: {
                    ...organizationAndTeamData,
                    userGitId,
                    prCount: prs?.length ?? 0,
                },
            });
            const assigned = await this.licenseService.assignLicense(
                organizationAndTeamData,
                userGitId,
                provider,
            );

            if (assigned) {
                return { shouldProceed: true, reason: 'ASSIGNED' };
            } else {
                return { shouldProceed: false, reason: 'ASSIGNMENT_FAILED' };
            }
        } catch (error) {
            this.logger.error({
                message: 'Failed to auto-assign license',
                error,
                context: AutoAssignLicenseUseCase.name,
                metadata: { ...organizationAndTeamData, userGitId },
            });
            return { shouldProceed: false, reason: 'ASSIGNMENT_FAILED' };
        }
    }
}
