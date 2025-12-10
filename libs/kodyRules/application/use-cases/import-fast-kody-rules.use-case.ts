import { Injectable, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { createLogger } from '@kodus/flow';
import { CreateOrUpdateKodyRulesUseCase } from './create-or-update.use-case';
import { ImportFastKodyRulesDto } from 'apps/api/src/dtos/import-fast-kody-rules.dto';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { KodyRuleSeverity } from '@libs/ee/kodyRules/dtos/create-kody-rule.dto';
import {
    KodyRulesOrigin,
    KodyRulesScope,
    KodyRulesStatus,
} from '@libs/kodyRules/domain/interfaces/kodyRules.interface';

@Injectable()
export class ImportFastKodyRulesUseCase {
    private readonly logger = createLogger(ImportFastKodyRulesUseCase.name);

    constructor(
        private readonly createOrUpdateKodyRulesUseCase: CreateOrUpdateKodyRulesUseCase,
        @Inject(REQUEST)
        private readonly request: Request & {
            user: {
                organization: { uuid: string };
                uuid: string;
                email: string;
            };
        },
    ) {}

    async execute(dto: ImportFastKodyRulesDto) {
        const organizationId = this.request.user?.organization?.uuid;
        if (!organizationId) {
            throw new Error('Organization ID not found');
        }

        const organizationAndTeamData: OrganizationAndTeamData = {
            organizationId,
            teamId: dto.teamId,
        };

        const results: any[] = [];

        for (const rule of dto.rules || []) {
            try {
                const payload = {
                    title: rule.title,
                    rule: rule.rule,
                    path: rule.path,
                    sourcePath: rule.sourcePath,
                    severity:
                        (rule.severity as KodyRuleSeverity) ||
                        KodyRuleSeverity.MEDIUM,
                    scope: rule.scope || KodyRulesScope.FILE,
                    repositoryId: rule.repositoryId,
                    origin: KodyRulesOrigin.USER,
                    status: KodyRulesStatus.ACTIVE,
                    examples: Array.isArray(rule.examples) ? rule.examples : [],
                };

                const created =
                    await this.createOrUpdateKodyRulesUseCase.execute(
                        payload as any,
                        organizationId,
                        {
                            userId: this.request.user?.uuid || 'kody-system',
                            userEmail:
                                (this.request.user as any)?.email ||
                                'kody@kodus.io',
                        },
                    );

                results.push(created);
            } catch (error) {
                this.logger.error({
                    message: 'Failed to import fast kody rule',
                    context: ImportFastKodyRulesUseCase.name,
                    error,
                    metadata: {
                        ruleTitle: rule?.title,
                        repositoryId: rule?.repositoryId,
                        organizationAndTeamData,
                    },
                });
            }
        }

        return results;
    }
}
