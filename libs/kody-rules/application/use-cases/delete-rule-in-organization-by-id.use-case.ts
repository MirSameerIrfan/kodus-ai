import { createLogger } from "@kodus/flow";
import {
    KODY_RULES_SERVICE_TOKEN,
    IKodyRulesService,
} from '@libs/kody-rules/domain/contracts/kodyRules.service.contract';
import { Injectable, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

@Injectable()
export class DeleteRuleInOrganizationByIdKodyRulesUseCase {
    private readonly logger = createLogger(DeleteRuleInOrganizationByIdKodyRulesUseCase.name);
    constructor(
        @Inject(REQUEST)
        private readonly request: Request & {
            user: {
                organization: { uuid: string };
                uuid: string;
                email: string;
            };
        },
        @Inject(KODY_RULES_SERVICE_TOKEN)
        private readonly kodyRulesService: IKodyRulesService
    ) {}

    async execute(ruleId: string) {
        try {
            if (!this.request.user.organization.uuid) {
                throw new Error('Organization ID not found');
            }

            return await this.kodyRulesService.deleteRuleWithLogging(
                {
                    organizationId: this.request.user.organization.uuid,
                },
                ruleId,
                {
                    userId: this.request.user.uuid,
                    userEmail: this.request.user.email,
                },
            );
        } catch (error) {
            this.logger.error({
                message: 'Error deleting Kody Rule in organization by ID',
                context: DeleteRuleInOrganizationByIdKodyRulesUseCase.name,
                error: error,
                metadata: {
                    organizationId: this.request.user.organization.uuid,
                    ruleId,
                },
            });
            throw error;
        }
    }
}
