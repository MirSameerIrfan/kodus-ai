import { createLogger } from '@kodus/flow';
import { Inject, Injectable } from '@nestjs/common';
import { BaseStage } from './base/base-stage.abstract';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';
import {
    COMMENT_MANAGER_SERVICE_TOKEN,
    ICommentManagerService,
} from '@libs/code-review/domain/contracts/CommentManagerService.contract';
import {
    ISuggestionService,
    SUGGESTION_SERVICE_TOKEN,
} from '@libs/code-review/domain/contracts/SuggestionService.contract';
import {
    IPullRequestsService,
    PULL_REQUESTS_SERVICE_TOKEN,
} from '@libs/code-review/domain/pull-requests/contracts/pullRequests.service.contracts';
import {
    DRY_RUN_SERVICE_TOKEN,
    IDryRunService,
} from '@libs/dry-run/domain/contracts/dryRun.service.contract';

@Injectable()
export class CreatePrLevelCommentsStage extends BaseStage {
    private readonly logger = createLogger(CreatePrLevelCommentsStage.name);
    readonly name = 'CreatePrLevelCommentsStage';
    readonly dependsOn: string[] = ['FileAnalysisStage']; // Depends on FileAnalysisStage

    constructor(
        @Inject(COMMENT_MANAGER_SERVICE_TOKEN)
        private readonly commentManagerService: ICommentManagerService,
        @Inject(SUGGESTION_SERVICE_TOKEN)
        private readonly suggestionService: ISuggestionService,
        @Inject(PULL_REQUESTS_SERVICE_TOKEN)
        private readonly pullRequestsService: IPullRequestsService,
        @Inject(DRY_RUN_SERVICE_TOKEN)
        private readonly dryRunService: IDryRunService,
    ) {
        super();
    }

    async execute(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        try {
            // Validações fundamentais de segurança
            if (!context?.organizationAndTeamData) {
                this.logger.error({
                    message: 'Missing organizationAndTeamData in context',
                    context: this.name,
                });
                return context;
            }

            if (!context?.pullRequest?.number) {
                this.logger.error({
                    message: 'Missing pullRequest data in context',
                    context: this.name,
                    metadata: {
                        organizationAndTeamData:
                            context.organizationAndTeamData,
                    },
                });
                return context;
            }

            if (!context?.repository?.name || !context?.repository?.id) {
                this.logger.error({
                    message: 'Missing repository data in context',
                    context: this.name,
                    metadata: {
                        organizationAndTeamData:
                            context.organizationAndTeamData,
                        prNumber: context.pullRequest.number,
                    },
                });
                return context;
            }

            // Verificar se há sugestões de nível de PR para processar
            const prLevelSuggestions = context?.validSuggestionsByPR || [];

            if (prLevelSuggestions.length === 0) {
                this.logger.log({
                    message: `No PR-level suggestions to process for PR#${context.pullRequest.number}`,
                    context: this.name,
                    metadata: {
                        organizationAndTeamData:
                            context.organizationAndTeamData,
                        prNumber: context.pullRequest.number,
                    },
                });
                return this.updateContext(context, (draft) => {});
            }

            try {
                this.logger.log({
                    message: `Starting PR-level comments creation for PR#${context.pullRequest.number}`,
                    context: this.name,
                    metadata: {
                        suggestionsCount: prLevelSuggestions.length,
                        organizationAndTeamData:
                            context.organizationAndTeamData,
                        prNumber: context.pullRequest.number,
                    },
                });

                let commentResults: any[] = [];

                try {
                    // Criar comentários para cada sugestão de nível de PR usando o commentManagerService
                    const result =
                        await this.commentManagerService.createPrLevelReviewComments(
                            context.organizationAndTeamData,
                            context.pullRequest.number,
                            {
                                name: context.repository.name,
                                id: context.repository.id,
                                language: context.repository.language || '',
                            },
                            prLevelSuggestions,
                            context.codeReviewConfig?.languageResultPrompt,
                            context.dryRun,
                        );

                    commentResults = result?.commentResults || [];

                    this.logger.log({
                        message: `Successfully created ${commentResults.length} PR-level comments for PR#${context.pullRequest.number}`,
                        context: this.name,
                        metadata: {
                            prNumber: context.pullRequest.number,
                            organizationAndTeamData:
                                context.organizationAndTeamData,
                            suggestionsCount: prLevelSuggestions.length,
                            commentsCreated: commentResults.length,
                        },
                    });
                } catch (error) {
                    this.logger.error({
                        message: `Error creating PR level comments for PR#${context.pullRequest.number}`,
                        context: this.name,
                        error,
                        metadata: {
                            prNumber: context.pullRequest.number,
                            organizationAndTeamData:
                                context.organizationAndTeamData,
                            suggestionsCount: prLevelSuggestions.length,
                        },
                    });
                    // Continua sem comentários
                    commentResults = [];
                }

                // Transformar commentResults em ISuggestionByPR e salvar no banco
                if (commentResults && commentResults.length > 0) {
                    try {
                        const transformedPrLevelSuggestions =
                            this.suggestionService.transformCommentResultsToPrLevelSuggestions(
                                commentResults,
                            );

                        if (transformedPrLevelSuggestions?.length > 0) {
                            try {
                                if (context.dryRun?.enabled) {
                                    await this.dryRunService.addPrLevelSuggestions(
                                        {
                                            organizationAndTeamData:
                                                context.organizationAndTeamData,
                                            id: context.dryRun?.id,
                                            prLevelSuggestions:
                                                transformedPrLevelSuggestions,
                                        },
                                    );
                                } else {
                                    await this.pullRequestsService.addPrLevelSuggestions(
                                        context.pullRequest.number,
                                        context.repository.name,
                                        transformedPrLevelSuggestions,
                                        context.organizationAndTeamData,
                                    );
                                }

                                this.logger.log({
                                    message: `Saved ${transformedPrLevelSuggestions.length} PR level suggestions to database`,
                                    context: this.name,
                                    metadata: {
                                        prNumber: context.pullRequest.number,
                                        repositoryName: context.repository.name,
                                        suggestionsCount:
                                            transformedPrLevelSuggestions.length,
                                        organizationAndTeamData:
                                            context.organizationAndTeamData,
                                    },
                                });
                            } catch (error) {
                                this.logger.error({
                                    message: `Error saving PR level suggestions to database`,
                                    context: this.name,
                                    error,
                                    metadata: {
                                        prNumber: context.pullRequest.number,
                                        repositoryName: context.repository.name,
                                        organizationAndTeamData:
                                            context.organizationAndTeamData,
                                    },
                                });
                                // Continua sem salvar no banco
                            }
                        }
                    } catch (error) {
                        this.logger.error({
                            message: `Error transforming comment results to PR level suggestions`,
                            context: this.name,
                            error,
                            metadata: {
                                prNumber: context.pullRequest.number,
                                organizationAndTeamData:
                                    context.organizationAndTeamData,
                                commentResultsCount: commentResults.length,
                            },
                        });
                        // Continua sem transformar
                    }
                }

                // Adicionar os resultados dos comentários ao contexto
                const finalContext = this.updateContext(context, (draft) => {
                    // Armazenar os resultados dos comentários de nível de PR
                    if (!draft.prLevelCommentResults) {
                        draft.prLevelCommentResults = [];
                    }

                    if (commentResults && commentResults?.length > 0) {
                        draft.prLevelCommentResults.push(...commentResults);
                    }
                });

                return finalContext;
            } catch (error) {
                this.logger.error({
                    message: `Error during PR-level comments creation for PR#${context.pullRequest.number}`,
                    context: this.name,
                    error,
                    metadata: {
                        organizationAndTeamData:
                            context.organizationAndTeamData,
                        suggestionsCount: prLevelSuggestions.length,
                    },
                });

                return context;
            }
        } catch (error) {
            this.logger.error({
                message: `Error during PR-level comments creation for PR#${context.pullRequest.number}`,
                context: this.name,
                error,
                metadata: {
                    organizationAndTeamData: context.organizationAndTeamData,
                    prNumber: context.pullRequest.number,
                },
            });
            return context;
        }
    }

    /**
     * Compensate: Delete PR-level comments created by this stage
     */
    async compensate(context: CodeReviewPipelineContext): Promise<void> {
        try {
            const prLevelCommentResults = context.prLevelCommentResults || [];

            if (prLevelCommentResults.length === 0) {
                return;
            }

            this.logger.log({
                message: `Compensating: Deleting ${prLevelCommentResults.length} PR-level comments for PR#${context.pullRequest.number}`,
                context: this.name,
                metadata: {
                    prNumber: context.pullRequest.number,
                    commentsCount: prLevelCommentResults.length,
                },
            });

            // Delete each comment created
            for (const commentResult of prLevelCommentResults) {
                try {
                    if (commentResult.comment?.id) {
                        await this.commentManagerService.deleteComment(
                            context.organizationAndTeamData,
                            context.pullRequest.number,
                            context.repository,
                            commentResult.comment.id,
                            context.platformType,
                        );
                    }
                } catch (error) {
                    this.logger.warn({
                        message: `Failed to delete PR-level comment during compensation`,
                        context: this.name,
                        error,
                        metadata: {
                            commentId: commentResult.comment?.id,
                            prNumber: context.pullRequest.number,
                        },
                    });
                    // Continue deleting other comments even if one fails
                }
            }
        } catch (error) {
            this.logger.error({
                message: `Error during compensation for CreatePrLevelCommentsStage`,
                context: this.name,
                error,
                metadata: {
                    prNumber: context.pullRequest.number,
                },
            });
            // Don't throw - compensation failures shouldn't break the workflow
        }
    }
}
