import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import {
    PULL_REQUESTS_REPOSITORY_TOKEN,
    IPullRequestsRepository,
} from '@/core/domain/pullRequests/contracts/pullRequests.repository';
import { ISuggestion } from '@/core/domain/pullRequests/interfaces/pullRequests.interface';

@Injectable()
export class FindSuggestionsByRuleUseCase {
    constructor(
        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string } };
        },

        @Inject(PULL_REQUESTS_REPOSITORY_TOKEN)
        private readonly pullRequestsRepository: IPullRequestsRepository,

        private readonly logger: PinoLoggerService,
    ) {}

    async execute(ruleId: string): Promise<ISuggestion[]> {
        try {
            if (!this.request.user.organization.uuid) {
                throw new Error('Organization ID not found');
            }

            if (!ruleId) {
                throw new Error('Rule ID is required');
            }

            const suggestions = await this.pullRequestsRepository.findSuggestionsByRuleId(
                ruleId,
                this.request.user.organization.uuid,
            );

            if (!suggestions || suggestions.length === 0) {
                return [];
            }

            return suggestions;
        } catch (error) {
            this.logger.error({
                message: 'Error finding suggestions by rule ID',
                context: FindSuggestionsByRuleUseCase.name,
                error: error,
                metadata: {
                    ruleId,
                    organizationId: this.request.user.organization?.uuid,
                },
            });
            throw error;
        }
    }
}

