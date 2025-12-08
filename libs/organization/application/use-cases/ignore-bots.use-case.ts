import { createLogger } from '@kodus/flow';
import { PULL_REQUEST_MANAGER_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/PullRequestManagerService.contract';
import {
    IOrganizationParametersService,
    ORGANIZATION_PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/org-parameters/contracts/organizationParameters.service.contract';
import { OrganizationParametersAutoAssignConfig } from '@libs/organization/domain/org-parameters/types/organizationParameters.types';
import { PullRequestHandlerService } from '@libs/code-review/infrastructure/pullRequestManager.service';
import { CodeManagementService } from '@libs/platform/infrastructure/facade/codeManagement.service';
import { OrganizationParametersKey } from '@shared/domain/enums/organization-parameters-key.enum';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class IgnoreBotsUseCase {
    private readonly logger = createLogger(IgnoreBotsUseCase.name);
    constructor(
        @Inject(PULL_REQUEST_MANAGER_SERVICE_TOKEN)
        private readonly pullRequestHandlerService: PullRequestHandlerService,
        private readonly codeManagementService: CodeManagementService,
        @Inject(ORGANIZATION_PARAMETERS_SERVICE_TOKEN)
        private readonly organizationParametersService: IOrganizationParametersService,
    ) {}

    public async execute(params: { organizationId: string; teamId: string }) {
        const organizationAndTeamData = {
            organizationId: params.organizationId,
            teamId: params.teamId,
        };

        const orgMembers = await this.codeManagementService.getListMembers({
            organizationAndTeamData,
            determineBots: true,
        });
        const prMembers =
            await this.pullRequestHandlerService.getPullRequestAuthorsWithCache(
                organizationAndTeamData,
                true,
            );

        const users = [...orgMembers, ...prMembers];

        if (users.length === 0) {
            this.logger.warn({
                message: 'No users found',
                context: IgnoreBotsUseCase.name,
                metadata: {
                    organizationId: organizationAndTeamData.organizationId,
                    teamId: organizationAndTeamData.teamId,
                },
            });
        }

        const botIds: string[] = Array.from(
            new Set(
                users.filter((user) => user.type === 'bot').map((b) => b.id),
            ),
        );

        const autoLicenseEntity =
            await this.organizationParametersService.findByKey(
                OrganizationParametersKey.AUTO_LICENSE_ASSIGNMENT,
                organizationAndTeamData,
            );

        if (!autoLicenseEntity || !autoLicenseEntity?.configValue) {
            this.logger.warn({
                message:
                    'Auto license assignment config not found, creating one',
                context: IgnoreBotsUseCase.name,
                metadata: {
                    organizationId: organizationAndTeamData.organizationId,
                    teamId: organizationAndTeamData.teamId,
                },
            });

            await this.organizationParametersService.createOrUpdateConfig(
                OrganizationParametersKey.AUTO_LICENSE_ASSIGNMENT,
                {
                    enabled: false,
                    ignoredUsers: botIds,
                },
                organizationAndTeamData,
            );
        } else {
            this.logger.log({
                message: 'Auto license assignment config found',
                context: IgnoreBotsUseCase.name,
                metadata: {
                    organizationId: organizationAndTeamData.organizationId,
                    teamId: organizationAndTeamData.teamId,
                },
            });

            const autoLicenseConfig =
                autoLicenseEntity.configValue as OrganizationParametersAutoAssignConfig;

            const allIgnored = new Set([
                ...autoLicenseConfig.ignoredUsers,
                ...botIds,
            ]);

            autoLicenseConfig.ignoredUsers = Array.from(allIgnored);

            await this.organizationParametersService.createOrUpdateConfig(
                OrganizationParametersKey.AUTO_LICENSE_ASSIGNMENT,
                autoLicenseConfig,
                organizationAndTeamData,
            );
        }
    }
}
