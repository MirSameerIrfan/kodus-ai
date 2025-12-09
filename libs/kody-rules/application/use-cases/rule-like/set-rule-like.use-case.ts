import { createLogger } from "@kodus/flow";
import { Inject, Injectable } from '@nestjs/common';
import { ProgrammingLanguage } from '@libs/core/domain/enums/programming-language.enum';
import {
    IRuleLikeService,
    RULE_LIKE_SERVICE_TOKEN,
} from '@libs/kody-rules/domain/contracts/ruleLike.service.contract';
import { RuleFeedbackType } from '@libs/kody-rules/domain/entities/ruleLike.entity';

@Injectable()
export class SetRuleLikeUseCase {
    private readonly logger = createLogger(SetRuleLikeUseCase.name);
    constructor(
        @Inject(RULE_LIKE_SERVICE_TOKEN)
        private readonly ruleLikeService: IRuleLikeService
    ) {}

    async execute(
        ruleId: string,
        feedback: RuleFeedbackType,
        userId?: string,
    ): Promise<any> {
        try {
            const result = await this.ruleLikeService.setFeedback(
                ruleId,
                feedback,
                userId,
            );

            // Retorna o objeto limpo ao invés da entity
            return result?.toObject() || null;
        } catch (error) {
            this.logger.error({
                message: `Failed to save rule feedback`,
                context: SetRuleLikeUseCase.name,
                error,
                metadata: {
                    ruleId,
                    feedback,
                    userId,
                },
            });
            throw error;
        }
    }
}
