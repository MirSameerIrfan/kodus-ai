import { createLogger } from '@kodus/flow';
import { CommentAnalysisService } from '@libs/code-review/infrastructure/commentAnalysis.service';
import { CodeManagementService } from '@libs/platform/infrastructure/facade/codeManagement.service';
import { GenerateKodyRulesDTO } from '@libs/common/dtos/generate-kody-rules.dto';
import { Inject, Injectable } from '@nestjs/common';

import { CreateOrUpdateKodyRulesUseCase } from './create-or-update.use-case';
import {
    CreateKodyRuleDto,
    KodyRuleSeverity,
} from '@libs/common/dtos/create-kody-rule.dto';
import {
    IKodyRule,
    KodyRulesStatus,
} from '@libs/kody-rules/domain/interfaces/kodyRules.interface';
import { FindRulesInOrganizationByRuleFilterKodyRulesUseCase } from './find-rules-in-organization-by-filter.use-case';
import { generateDateFilter } from '@libs/common/utils/transforms/date';
import {
    IIntegrationConfigService,
    INTEGRATION_CONFIG_SERVICE_TOKEN,
} from '@libs/integrations/domain/configs/contracts/integration-config.service.contracts';
import {
    IIntegrationService,
    INTEGRATION_SERVICE_TOKEN,
} from '@libs/integrations/domain/contracts/integration.service.contracts';
import { IntegrationConfigKey } from '@libs/common/enums/Integration-config-key.enum';
import { Repositories } from '@libs/platform/domain/types/codeManagement/repositories.type';
import {
    IParametersService,
    PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/parameters/contracts/parameters.service.contract';
import { ParametersKey } from '@libs/common/enums/parameters-key.enum';
import { KodyLearningStatus } from '@libs/organization/domain/parameters/types/configValue.type';
import { ParametersEntity } from '@libs/organization/domain/parameters/entities/parameters.entity';
import { OrganizationAndTeamData } from '@libs/common/types/general/organizationAndTeamData';
import { SendRulesNotificationUseCase } from './send-rules-notification.use-case';
import { REQUEST } from '@nestjs/core';
import {
    ICodeRepository,
    CodeReviewParameter,
    RepositoryCodeReviewConfig,
} from '@libs/common/types/general/codeReviewConfig.type';

@Injectable()
export class CheckSyncStatusUseCase {
    private readonly logger = createLogger(CheckSyncStatusUseCase.name);
    constructor(
        @Inject(INTEGRATION_SERVICE_TOKEN)
        private readonly integrationService: IIntegrationService,
        @Inject(INTEGRATION_CONFIG_SERVICE_TOKEN)
        private readonly integrationConfigService: IIntegrationConfigService,
        @Inject(PARAMETERS_SERVICE_TOKEN)
        private readonly parametersService: IParametersService,
        private readonly findRulesInOrganizationByRuleFilterKodyRulesUseCase: FindRulesInOrganizationByRuleFilterKodyRulesUseCase,
        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string } };
        },
    ) {}

    async execute(
        teamId: string,
        repositoryId?: string,
    ): Promise<{
        ideRulesSyncEnabledFirstTime: boolean;
        kodyRulesGeneratorEnabledFirstTime: boolean;
    }> {
        const syncStatusFlags = {
            ideRulesSyncEnabledFirstTime: true,
            kodyRulesGeneratorEnabledFirstTime: true,
        };

        const organizationAndTeamData = {
            organizationId: this.request.user.organization.uuid,
            teamId: teamId,
        };

        const platformConfig = await this.parametersService.findByKey(
            ParametersKey.PLATFORM_CONFIGS,
            organizationAndTeamData,
        );

        try {
            const codeReviewConfigs: CodeReviewParameter =
                await this.getCodeReviewConfigs(organizationAndTeamData);

            const currentRepositoryConfig = codeReviewConfigs.repositories.find(
                (repository: RepositoryCodeReviewConfig) =>
                    repository.id === repositoryId,
            ) as RepositoryCodeReviewConfig;

            // Se não encontrou o repositório, retorna configuração padrão
            if (!currentRepositoryConfig) {
                return syncStatusFlags;
            }

            const ideRulesSyncEnabled =
                currentRepositoryConfig.configs.ideRulesSyncEnabled;

            if (!ideRulesSyncEnabled) {
                const rules =
                    await this.findRulesInOrganizationByRuleFilterKodyRulesUseCase.execute(
                        organizationAndTeamData.organizationId,
                        {},
                        repositoryId,
                    );

                const ideRules = rules?.find((rule) =>
                    rule?.rules?.find((r: IKodyRule) => r.sourcePath),
                );

                syncStatusFlags.ideRulesSyncEnabledFirstTime = !ideRules;
            }

            const kodyRulesGeneratorEnabled =
                currentRepositoryConfig.configs.kodyRulesGeneratorEnabled;

            if (
                platformConfig.configValue.kodyLearningStatus ===
                KodyLearningStatus.DISABLED
            ) {
                syncStatusFlags.kodyRulesGeneratorEnabledFirstTime = false;
            } else {
                syncStatusFlags.kodyRulesGeneratorEnabledFirstTime =
                    kodyRulesGeneratorEnabled;
            }

            return syncStatusFlags;
        } catch (error) {
            this.logger.error({
                message: 'Error checking sync status',
                error,
                context: CheckSyncStatusUseCase.name,
                metadata: {
                    organizationId: this.request.user.organization.uuid,
                    teamId,
                    repositoryId,
                },
            });

            return syncStatusFlags;
        }
    }

    private async getCodeReviewConfigs(
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<CodeReviewParameter> {
        const codeReviewConfig = await this.parametersService.findByKey(
            ParametersKey.CODE_REVIEW_CONFIG,
            organizationAndTeamData,
        );

        return codeReviewConfig?.configValue;
    }

    private async getFormattedRepositories(
        organizationAndTeamData: OrganizationAndTeamData,
    ) {
        return await this.integrationConfigService.findIntegrationConfigFormatted<
            ICodeRepository[]
        >(IntegrationConfigKey.REPOSITORIES, organizationAndTeamData);
    }
}
