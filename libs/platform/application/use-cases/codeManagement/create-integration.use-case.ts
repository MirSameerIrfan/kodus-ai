import { createLogger } from '@kodus/flow';
import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import { ActionType } from '@libs/core/infrastructure/config/types/general/codeReviewSettingsLog.type';
import {
    AUTH_INTEGRATION_SERVICE_TOKEN,
    IAuthIntegrationService,
} from '@libs/integrations/domain/authIntegrations/contracts/auth-integration.service.contracts';
import { IgnoreBotsUseCase } from '@libs/organization/application/use-cases/organizationParameters/ignore-bots.use-case';
import { AuthMode } from '@libs/platform/domain/platformIntegrations/enums/codeManagement/authMode.enum';
import { CodeManagementService } from '@libs/platform/infrastructure/adapters/services/codeManagement.service';
import {
    CODE_REVIEW_SETTINGS_LOG_SERVICE_TOKEN,
    ICodeReviewSettingsLogService,
} from '@libs/ee/codeReviewSettingsLog/domain/contracts/codeReviewSettingsLog.service.contract';

@Injectable()
export class CreateIntegrationUseCase implements IUseCase {
    private readonly logger = createLogger(CreateIntegrationUseCase.name);
    constructor(
        private readonly codeManagementService: CodeManagementService,
        @Inject(CODE_REVIEW_SETTINGS_LOG_SERVICE_TOKEN)
        private readonly codeReviewSettingsLogService: ICodeReviewSettingsLogService,
        @Inject(REQUEST)
        private readonly request: Request & {
            user: {
                organization: { uuid: string };
                uuid: string;
                email: string;
            };
        },
        @Inject(AUTH_INTEGRATION_SERVICE_TOKEN)
        private readonly authIntegrationService: IAuthIntegrationService,
        private readonly ignoreBotsUseCase: IgnoreBotsUseCase,
    ) {}

    public async execute(params: any): Promise<any> {
        const authMode = params?.authMode ?? AuthMode.OAUTH;

        const organizationAndTeamData = {
            organizationId:
                params?.organizationAndTeamData?.organizationId ||
                this.request.user?.organization?.uuid,
            teamId: params?.organizationAndTeamData?.teamId,
        };

        const result = await this.codeManagementService.createAuthIntegration(
            {
                ...params,
                organizationAndTeamData,
                authMode,
            },
            params.integrationType,
        );

        this.ignoreBotsUseCase
            .execute({
                organizationId: organizationAndTeamData.organizationId,
                teamId: organizationAndTeamData.teamId,
            })
            .catch((error) => {
                this.logger.error({
                    message: 'Error ignoring bots',
                    error: error,
                    context: CreateIntegrationUseCase.name,
                    metadata: {
                        organizationAndTeamData: organizationAndTeamData,
                    },
                });
            });

        try {
            // Buscar a auth integration criada com os dados corretos de organização/team
            const authIntegration = await this.authIntegrationService.findOne({
                organization: {
                    uuid: organizationAndTeamData.organizationId,
                },
                team: {
                    uuid: organizationAndTeamData.teamId,
                },
            });

            await this.codeReviewSettingsLogService.registerIntegrationLog({
                organizationAndTeamData: {
                    organizationId: organizationAndTeamData.organizationId,
                    teamId: organizationAndTeamData.teamId,
                },
                userInfo: {
                    userId: this.request.user?.uuid,
                    userEmail: this.request.user?.email,
                },
                integration: {
                    platform:
                        params.integrationType?.toUpperCase() || 'UNKNOWN',
                    integrationCategory: 'CODE_MANAGEMENT',
                    authIntegration: authIntegration,
                },
                actionType: ActionType.CREATE,
            });
        } catch (error) {
            this.logger.error({
                message: 'Error saving code review settings log',
                error: error,
                context: CreateIntegrationUseCase.name,
                metadata: {
                    organizationAndTeamData: organizationAndTeamData,
                },
            });
        }

        return result;
    }
}
