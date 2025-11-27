import { createLogger } from "@kodus/flow";
import { Inject, Injectable } from '@nestjs/common';
import {
    IRuleLikeService,
    RULE_LIKE_SERVICE_TOKEN,
} from '@/core/domain/kodyRules/contracts/ruleLike.service.contract';
import { REQUEST } from '@nestjs/core';

@Injectable()
export class GetAllRulesWithLikesUseCase {
    private readonly logger = createLogger(GetAllRulesWithLikesUseCase.name);
    constructor(
        @Inject(RULE_LIKE_SERVICE_TOKEN)
        private readonly ruleLikeService: IRuleLikeService,
        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string }, uuid: string };
        }
    ) {}

    async execute() {
        try {
            return this.ruleLikeService.getAllRulesWithFeedback(this.request.user.uuid);
        } catch (error) {
            this.logger.error({
                message: `Failed to get all rules with likes`,
                context: GetAllRulesWithLikesUseCase.name,
                error,
                metadata: {
                    userId: this.request.user.uuid,
                },
            });
        }
    }
}
