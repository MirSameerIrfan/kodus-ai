import { KodyRulesStatus } from '@libs/kody-rules/domain/interfaces/kodyRules.interface';
import {
    IParametersService,
    PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/parameters/contracts/parameters.service.contract';
import { ParametersKey } from '@libs/core/domain/enums/parameters-key.enum';
import { createLogger } from '@kodus/flow';
import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { CreatePRCodeReviewUseCase } from './create-prs-code-review.use-case';
import { GenerateKodyRulesUseCase } from '@libs/kody-rules/application/use-cases/generate-kody-rules.use-case';
import { FindRulesInOrganizationByRuleFilterKodyRulesUseCase } from '@libs/kody-rules/application/use-cases/find-rules-in-organization-by-filter.use-case';
import { ChangeStatusKodyRulesUseCase } from '@libs/kody-rules/application/use-cases/change-status-kody-rules.use-case';
import { SyncSelectedRepositoriesKodyRulesUseCase } from '@libs/kody-rules/application/use-cases/sync-selected-repositories.use-case';
import { FinishOnboardingDTO } from 'apps/api/src/dtos/finish-onboarding.dto';

@Injectable()
export class FinishOnboardingUseCase {
    private readonly logger = createLogger(FinishOnboardingUseCase.name);
    constructor(
        @Inject(PARAMETERS_SERVICE_TOKEN)
        private readonly parametersService: IParametersService,
        private readonly reviewPRUseCase: CreatePRCodeReviewUseCase,
        private readonly generateKodyRulesUseCase: GenerateKodyRulesUseCase,
        private readonly findKodyRulesUseCase: FindRulesInOrganizationByRuleFilterKodyRulesUseCase,
        private readonly changeStatusKodyRulesUseCase: ChangeStatusKodyRulesUseCase,
        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string } };
        },
        private readonly syncSelectedReposKodyRulesUseCase: SyncSelectedRepositoriesKodyRulesUseCase,
    ) {}

    async execute(params: FinishOnboardingDTO) {
        let platformConfig;

        try {
            if (!this.request?.user?.organization?.uuid) {
                throw new Error('Organization ID not found');
            }

            const {
                teamId,
                reviewPR,
                pullNumber,
                repositoryName,
                repositoryId,
            } = params;

            const organizationId = this.request.user.organization.uuid;

            platformConfig = await this.parametersService.findByKey(
                ParametersKey.PLATFORM_CONFIGS,
                { organizationId, teamId },
            );

            if (!platformConfig || !platformConfig.configValue) {
                throw new Error('Platform config not found');
            }

            await this.parametersService.createOrUpdateConfig(
                ParametersKey.PLATFORM_CONFIGS,
                {
                    ...platformConfig.configValue,
                    finishOnboard: true,
                },
                { organizationId, teamId },
            );

            await this.generateKodyRulesUseCase.execute(
                { teamId, months: 3 },
                organizationId,
            );

            // enable all generated rules
            const rules = await this.findKodyRulesUseCase.execute(
                organizationId,
                {},
            );

            if (rules && rules.length > 0) {
                const ruleIds = rules.map((rule) => rule.uuid);
                await this.changeStatusKodyRulesUseCase.execute({
                    ruleIds,
                    status: KodyRulesStatus.ACTIVE,
                });
            }

            // Trigger immediate Kody Rules sync from repo files for all selected repositories
            await this.syncSelectedReposKodyRulesUseCase.execute({ teamId });

            if (reviewPR) {
                if (!pullNumber || !repositoryName || !repositoryId) {
                    throw new Error('Invalid PR data');
                }

                await this.reviewPRUseCase.execute({
                    teamId,
                    payload: {
                        id: repositoryId,
                        repository: repositoryName,
                        pull_number: pullNumber,
                    },
                });
            }
        } catch (error) {
            this.logger.error({
                message: 'Error on OnboardingReviewPRUseCase',
                context: FinishOnboardingUseCase.name,
                error,
                metadata: params,
            });

            throw error;
        }
    }
}
