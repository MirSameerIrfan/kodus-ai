import { Inject, Injectable } from '@nestjs/common';

import { createLogger } from '@kodus/flow';
import {
    IOrganizationParametersService,
    ORGANIZATION_PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/organizationParameters/contracts/organizationParameters.service.contract';
import { OrganizationParametersKey } from '@libs/core/domain/enums';
import { OrganizationParametersAutoAssignConfig } from '@libs/organization/domain/organizationParameters/types/organizationParameters.types';

@Injectable()
export class IgnoreBotsUseCase {
    private readonly logger = createLogger(IgnoreBotsUseCase.name);

    constructor(
        @Inject(ORGANIZATION_PARAMETERS_SERVICE_TOKEN)
        private readonly organizationParametersService: IOrganizationParametersService,
    ) {}

    public async execute(params: {
        organizationId: string;
        teamId: string;
        botIds: string[];
    }) {
        const organizationAndTeamData = {
            organizationId: params.organizationId,
            teamId: params.teamId,
        };

        const botIds = params.botIds || [];

        if (botIds.length === 0) {
            this.logger.warn({
                message: 'No bots provided to ignore',
                context: IgnoreBotsUseCase.name,
                metadata: {
                    organizationId: organizationAndTeamData.organizationId,
                    teamId: organizationAndTeamData.teamId,
                },
            });
        }

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
                    allowedUsers: [],
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

            autoLicenseConfig.allowedUsers =
                autoLicenseConfig.allowedUsers || [];

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
