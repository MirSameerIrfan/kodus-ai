import { createLogger } from '@kodus/flow';
import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import {
    CONTEXT_REFERENCE_SERVICE_TOKEN,
    IContextReferenceService,
} from '@libs/ai-engine/domain/contextReference/contracts/context-reference.service.contract';
import { UserRequest } from '@libs/core/infrastructure/config/types/http/user-request.type';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { AuthorizationService } from '@libs/identity/infrastructure/adapters/services/permissions/authorization.service';
import {
    IKodyRulesService,
    KODY_RULES_SERVICE_TOKEN,
} from '@libs/kodyRules/domain/contracts/kodyRules.service.contract';
import { IKodyRule } from '@libs/kodyRules/domain/interfaces/kodyRules.interface';

import { enrichRulesWithContextReferences } from './utils/enrich-rules-with-context-references.util';

@Injectable()
export class FindRulesInOrganizationByRuleFilterKodyRulesUseCase {
    private readonly logger = createLogger(
        FindRulesInOrganizationByRuleFilterKodyRulesUseCase.name,
    );
    constructor(
        @Inject(KODY_RULES_SERVICE_TOKEN)
        private readonly kodyRulesService: IKodyRulesService,
        @Inject(REQUEST)
        private readonly request: UserRequest,
        private readonly authorizationService: AuthorizationService,
        @Inject(CONTEXT_REFERENCE_SERVICE_TOKEN)
        private readonly contextReferenceService: IContextReferenceService,
    ) {}

    async execute(
        organizationId: string,
        filter: Partial<IKodyRule>,
        repositoryId?: string,
        directoryId?: string,
    ) {
        try {
            await this.authorizationService.ensure({
                user: this.request.user,
                action: Action.Read,
                resource: ResourceType.KodyRules,
                repoIds: [repositoryId],
            });

            const ruleFilters: Partial<IKodyRule>[] = [];

            if (repositoryId && directoryId) {
                ruleFilters.push({ repositoryId, directoryId });
                ruleFilters.push({ repositoryId: 'global' });
            } else if (repositoryId) {
                ruleFilters.push({ repositoryId });
                ruleFilters.push({ repositoryId: 'global' });
            } else if (directoryId) {
                ruleFilters.push({ directoryId });
            }

            const existingRules = await this.kodyRulesService.find({
                organizationId,
                ...(ruleFilters.length ? { rules: ruleFilters } : {}),
            });

            if (!existingRules || existingRules.length === 0) {
                return [];
            }

            const allRules = existingRules.reduce((acc, entity) => {
                return [...acc, ...entity.rules];
            }, []);

            let filteredRules = allRules;

            if (repositoryId && !directoryId) {
                filteredRules = allRules.filter(
                    (rule) =>
                        rule.repositoryId === 'global' ||
                        (rule.repositoryId === repositoryId &&
                            !rule.directoryId),
                );
            } else if (repositoryId && directoryId) {
                filteredRules = allRules.filter(
                    (rule) =>
                        rule.repositoryId === 'global' ||
                        (rule.repositoryId === repositoryId &&
                            rule.directoryId === directoryId),
                );
            }

            // Aplica o filtro personalizado passado como parâmetro
            const rules = filteredRules.filter((rule) => {
                for (const key in filter) {
                    if (rule[key] !== filter[key]) {
                        return false;
                    }
                }
                return true;
            });

            return await enrichRulesWithContextReferences(
                rules,
                this.contextReferenceService,
                this.logger,
            );
        } catch (error) {
            this.logger.error({
                message:
                    'Error finding Kody Rules in organization by rule filter',
                context:
                    FindRulesInOrganizationByRuleFilterKodyRulesUseCase.name,
                error: error,
                metadata: {
                    organizationId,
                    filter,
                },
            });
            throw error;
        }
    }
}
