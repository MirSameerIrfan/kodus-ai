import { Body, Controller, Delete, Inject, Param, Post } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import { RemoveRuleLikeUseCase } from '@libs/kody-rules/application/use-cases/rule-like/remove-rule-like.use-case';
import { SetRuleLikeUseCase } from '@libs/kody-rules/application/use-cases/rule-like/set-rule-like.use-case';

import { SetRuleFeedbackDto } from '../dtos/set-rule-feedback.dto';

@Controller('rule-like')
export class RuleLikeController {
    constructor(
        private readonly setRuleLikeUseCase: SetRuleLikeUseCase,
        private readonly removeRuleLikeUseCase: RemoveRuleLikeUseCase,

        @Inject(REQUEST)
        private readonly request: Request & {
            user: { uuid: string; organization: { uuid: string } };
        },
    ) {}

    @Post(':ruleId/feedback')
    async setFeedback(
        @Param('ruleId') ruleId: string,
        @Body() body: SetRuleFeedbackDto,
    ) {
        if (!this.request.user?.uuid) {
            throw new Error('User not authenticated');
        }

        return this.setRuleLikeUseCase.execute(
            ruleId,
            body.feedback,
            this.request.user.uuid,
        );
    }

    @Delete(':ruleId/feedback')
    async removeFeedback(@Param('ruleId') ruleId: string) {
        if (!this.request.user?.uuid) {
            throw new Error('User not authenticated');
        }

        return this.removeRuleLikeUseCase.execute(
            ruleId,
            this.request.user.uuid,
        );
    }
}
