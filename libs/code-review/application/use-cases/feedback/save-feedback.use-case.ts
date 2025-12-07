import { createLogger } from "@kodus/flow";
import { CodeReviewFeedbackEntity } from '@libs/code-review/domain/feedback/entities/codeReviewFeedback.entity';
import { ICodeReviewFeedback } from '@libs/code-review/domain/feedback/interfaces/codeReviewFeedback.interface';
import { CodeReviewFeedbackService } from '@libs/code-review/infrastructure/feedback/codeReviewFeedback.service';
import { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
import { IUseCase } from '@shared/domain/interfaces/use-case.interface';
import { Inject, Injectable } from '@nestjs/common';
import { CODE_REVIEW_FEEDBACK_SERVICE_TOKEN } from '@libs/code-review/domain/feedback/contracts/codeReviewFeedback.service.contract';
import { GetReactionsUseCase } from './get-reactions.use-case';

@Injectable()
export class SaveCodeReviewFeedbackUseCase implements IUseCase {
    private readonly logger = createLogger(SaveCodeReviewFeedbackUseCase.name);
    constructor(
        @Inject(CODE_REVIEW_FEEDBACK_SERVICE_TOKEN)
        private readonly codeReviewFeedbackService: CodeReviewFeedbackService,
        private readonly getReactionsUseCase: GetReactionsUseCase
    ) {}

    async execute(payload: {
        organizationId: string;
        teamId: string;
        automationExecutionsPRs: number[];
    }): Promise<CodeReviewFeedbackEntity[]> {
        try {
            const reactions = await this.getReactions(
                {
                    organizationId: payload.organizationId,
                    teamId: payload.teamId,
                },
                payload.automationExecutionsPRs,
            );

            return await this.codeReviewFeedbackService.bulkCreate(
                reactions as Omit<ICodeReviewFeedback, 'uuid'>[],
            );
        } catch (error) {
            this.logger.error({
                message: 'Error save code review feedback',
                context: SaveCodeReviewFeedbackUseCase.name,
                error,
                metadata: { payload },
            });
            throw error;
        }
    }

    private async getReactions(
        organizationAndTeamData: OrganizationAndTeamData,
        automationExecutionsPRs: number[],
    ) {
        return this.getReactionsUseCase.execute(
            organizationAndTeamData,
            automationExecutionsPRs,
        );
    }
}
