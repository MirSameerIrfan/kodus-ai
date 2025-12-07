import { createLogger } from "@kodus/flow";
import { UserRequest } from '@/config/types/http/user-request.type';
import {
    KODY_RULES_SERVICE_TOKEN,
    IKodyRulesService,
} from '@libs/kody-rules/domain/contracts/kodyRules.service.contract';
import { IKodyRule } from '@libs/kody-rules/domain/interfaces/kodyRules.interface';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { AuthorizationService } from '@libs/identity/infrastructure/permissions/authorization.service';
import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import {
    CONTEXT_REFERENCE_SERVICE_TOKEN,
    IContextReferenceService,
} from '@libs/code-review/domain/context/contracts/context-reference.service.contract';
import { enrichRulesWithContextReferences } from './utils/enrich-rules-with-context-references.util';

@Injectable()
export class FindRulesInOrganizationByRuleFilterKodyRulesUseCase {
    private readonly logger = createLogger(FindRulesInOrganizationByRuleFilterKodyRulesUseCase.name);
    constructor(
        @Inject(KODY_RULES_SERVICE_TOKEN)
        private readonly kodyRulesService: IKodyRulesService,
        @Inject(REQUEST)
        private readonly request: UserRequest,
        private readonly authorizationService: AuthorizationService,
        @Inject(CONTEXT_REFERENCE_SERVICE_TOKEN)
        private readonly contextReferenceService: IContextReferenceService
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

            const existingRules = await this.kodyRulesService.find({
                organizationId,
                rules: [{ repositoryId, directoryId }],
            });

            if (!existingRules || existingRules.length === 0) {
                return [];
            }

            const allRules = existingRules.reduce((acc, entity) => {
                return [...acc, ...entity.rules];
            }, []);

            let filteredRules = allRules;

            if (repositoryId && !directoryId) {
                filteredRules = allRules.filter((rule) => !rule.directoryId);
            } else if (repositoryId && directoryId) {
                filteredRules = allRules.filter(
                    (rule) => rule.directoryId === directoryId,
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
