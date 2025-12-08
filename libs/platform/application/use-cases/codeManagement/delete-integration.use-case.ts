import { createLogger } from '@kodus/flow';
import { Inject, Injectable } from '@nestjs/common';
import { CodeManagementService } from '@libs/platform/infrastructure/facade/codeManagement.service';
import { IntegrationCategory } from '@shared/domain/enums/integration-category.enum';
import { AuthIntegrationService } from '@libs/integrations/infrastructure/authIntegration.service';
import { INTEGRATION_SERVICE_TOKEN } from '@libs/integrations/domain/contracts/integration.service.contracts';
import { IntegrationConfigService } from '@libs/integrations/infrastructure/integrationConfig.service';
import { IntegrationService } from '@libs/integrations/infrastructure/integration.service';
import { AUTH_INTEGRATION_SERVICE_TOKEN } from '@libs/integrations/domain/auth/contracts/auth-integration.service.contracts';
import { INTEGRATION_CONFIG_SERVICE_TOKEN } from '@libs/integrations/domain/configs/contracts/integration-config.service.contracts';
import { IntegrationConfigKey } from '@shared/domain/enums/Integration-config-key.enum';
import { REQUEST } from '@nestjs/core';
import {
    CODE_REVIEW_SETTINGS_LOG_SERVICE_TOKEN,
    ICodeReviewSettingsLogService,
} from '@libs/analytics/ee/settings-log/domain/codeReviewSettingsLog/contracts/codeReviewSettingsLog.service.contract';
import { ActionType } from '@shared/types/general/codeReviewSettingsLog.type';

@Injectable()
export class DeleteIntegrationUseCase {
    private readonly logger = createLogger(DeleteIntegrationUseCase.name);
    constructor(
        private readonly codeManagementService: CodeManagementService,
        @Inject(INTEGRATION_SERVICE_TOKEN)
        private readonly integrationService: IntegrationService,
        @Inject(AUTH_INTEGRATION_SERVICE_TOKEN)
        private readonly authIntegrationService: AuthIntegrationService,
        @Inject(INTEGRATION_CONFIG_SERVICE_TOKEN)
        private readonly integrationConfigService: IntegrationConfigService,
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
    ) {}

    async execute(params: {
        organizationId: string;
        teamId: string;
    }): Promise<void> {
        const integration = await this.integrationService.findOne({
            organization: { uuid: params.organizationId },
            team: { uuid: params.teamId },
            integrationCategory: IntegrationCategory.CODE_MANAGEMENT,
            status: true,
        });

        if (!integration) {
            return;
        }

        await this.codeManagementService.deleteWebhook({
            organizationAndTeamData: {
                organizationId: params.organizationId,
                teamId: params.teamId,
            },
        });

        const integrationConfig = await this.integrationConfigService.findOne({
            configKey: IntegrationConfigKey.REPOSITORIES,
            integration: { uuid: integration.uuid },
            team: { uuid: params.teamId },
        });

        if (integrationConfig) {
            await this.integrationConfigService.delete(integrationConfig.uuid);
        }

        try {
            this.codeReviewSettingsLogService.registerIntegrationLog({
                organizationAndTeamData: {
                    organizationId: params.organizationId,
                    teamId: params.teamId,
                },
                userInfo: {
                    userId: this.request.user.uuid,
                    userEmail: this.request.user.email,
                },
                integration,
                actionType: ActionType.DELETE,
            });
        } catch (error) {
            this.logger.error({
                message: 'Error saving code review settings log',
                error: error,
                context: DeleteIntegrationUseCase.name,
                metadata: {
                    organizationAndTeamData: {
                        organizationId: this.request.user.organization.uuid,
                        teamId: params.teamId,
                    },
                },
            });
        }

        await this.integrationService.delete(integration.uuid);

        await this.authIntegrationService.delete(
            integration.authIntegration.uuid,
        );
    }
}
