import {
    KODY_RULES_SERVICE_TOKEN,
    IKodyRulesService,
} from '@/core/domain/kodyRules/contracts/kodyRules.service.contract';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import {
    CONTEXT_REFERENCE_SERVICE_TOKEN,
    IContextReferenceService,
} from '@/core/domain/contextReferences/contracts/context-reference.service.contract';
import { enrichRulesWithContextReferences } from './utils/enrich-rules-with-context-references.util';

@Injectable()
export class FindByOrganizationIdKodyRulesUseCase {
    constructor(
        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string } };
        },

        @Inject(KODY_RULES_SERVICE_TOKEN)
        private readonly kodyRulesService: IKodyRulesService,

        @Inject(CONTEXT_REFERENCE_SERVICE_TOKEN)
        private readonly contextReferenceService: IContextReferenceService,

        private readonly logger: PinoLoggerService,
    ) {}

    async execute() {
        try {
            if (!this.request.user.organization.uuid) {
                throw new Error('Organization ID not found');
            }

            const existing = await this.kodyRulesService.findByOrganizationId(
                this.request.user.organization.uuid,
            );

            if (!existing) {
                throw new NotFoundException(
                    'No Kody rules found for the given organization ID',
                );
            }

            const enrichedRulesArray =
                await enrichRulesWithContextReferences(
                    existing.rules || [],
                    this.contextReferenceService,
                    this.logger,
                );

            return {
                ...existing,
                rules: enrichedRulesArray,
            };
        } catch (error) {
            this.logger.error({
                message: 'Error finding Kody Rules by organization ID',
                context: FindByOrganizationIdKodyRulesUseCase.name,
                error: error,
                metadata: {
                    organizationId: this.request.user.organization.uuid,
                },
            });
            throw error;
        }
    }

}
