import { createLogger } from '@kodus/flow';
import { CodeReviewFeedbackEntity } from '@libs/code-review/domain/feedback/entities/codeReviewFeedback.entity';
import { ICodeReviewFeedback } from '@libs/code-review/domain/feedback/interfaces/codeReviewFeedback.interface';
import { CodeReviewFeedbackService } from '@libs/code-review/infrastructure/feedback/codeReviewFeedback.service';
import { OrganizationAndTeamData } from '@libs/core/domain/types/general/organizationAndTeamData';
import { Inject, Injectable } from '@nestjs/common';
import { CODE_REVIEW_FEEDBACK_SERVICE_TOKEN } from '@libs/code-review/domain/feedback/contracts/codeReviewFeedback.service.contract';
import { GetReactionsUseCase } from './get-reactions.use-case';
import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';

@Injectable()
export class SaveCodeReviewFeedbackUseCase implements IUseCase {
    private readonly logger = createLogger(SaveCodeReviewFeedbackUseCase.name);
    constructor(
        @Inject(CODE_REVIEW_FEEDBACK_SERVICE_TOKEN)
        private readonly codeReviewFeedbackService: CodeReviewFeedbackService,
        private readonly getReactionsUseCase: GetReactionsUseCase,
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

            // Buscar feedbacks existentes para evitar duplicações
            const existingFeedbacks =
                await this.codeReviewFeedbackService.getByOrganizationId(
                    payload.organizationId,
                );

            // Montar array com todos os suggestionIds já salvos
            const existingSuggestionIds = new Set(
                existingFeedbacks?.map((feedback) => feedback.suggestionId) ||
                    [],
            );

            // Filtrar reactions removendo as que já foram salvas
            const newReactions = reactions.filter(
                (reaction) => !existingSuggestionIds.has(reaction.suggestionId),
            );

            this.logger.log({
                message: 'Filtering reactions to avoid duplicates',
                context: SaveCodeReviewFeedbackUseCase.name,
                metadata: {
                    totalReactions: reactions.length,
                    existingSuggestionIds: existingSuggestionIds.size,
                    newReactions: newReactions.length,
                    organizationId: payload.organizationId,
                },
            });

            if (newReactions.length === 0) {
                this.logger.log({
                    message: 'No new reactions to save (all already exist)',
                    context: SaveCodeReviewFeedbackUseCase.name,
                    metadata: { payload },
                });
                return [];
            }

            return await this.codeReviewFeedbackService.bulkCreate(
                newReactions as Omit<ICodeReviewFeedback, 'uuid'>[],
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
