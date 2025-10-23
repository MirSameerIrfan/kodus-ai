import { Injectable } from '@nestjs/common';
import { BasePipelineStage } from '../../../pipeline/base-stage.abstract';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';
import { PinoLoggerService } from '../../../logger/pino.service';
import { PromptExternalReferenceManagerService } from '@/core/infrastructure/adapters/services/prompts/promptExternalReferenceManager.service';
import { PromptContextLoaderService } from '@/core/infrastructure/adapters/services/prompts/promptContextLoader.service';

@Injectable()
export class LoadExternalContextStage extends BasePipelineStage<CodeReviewPipelineContext> {
    readonly stageName = 'LoadExternalContextStage';

    constructor(
        private readonly promptReferenceManager: PromptExternalReferenceManagerService,
        private readonly promptContextLoader: PromptContextLoaderService,
        private readonly logger: PinoLoggerService,
    ) {
        super();
    }

    protected async executeStage(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        try {
            const { organizationId } = context.organizationAndTeamData;
            const repositoryId = context.repository?.id;
            const directoryId = context.codeReviewConfig?.directoryId;

            const configKeys =
                this.promptReferenceManager.buildConfigKeysHierarchy(
                    organizationId,
                    repositoryId,
                    directoryId,
                );

            this.logger.log({
                message: 'Loading external prompt context',
                context: this.stageName,
                metadata: {
                    organizationId,
                    repositoryId,
                    directoryId,
                    configKeys,
                    prNumber: context.pullRequest.number,
                },
            });

            const allReferences =
                await this.promptReferenceManager.findByConfigKeys(configKeys);

            if (!allReferences || allReferences.length === 0) {
                this.logger.log({
                    message: 'No external references found for this config',
                    context: this.stageName,
                    metadata: {
                        organizationId,
                        repositoryId,
                        prNumber: context.pullRequest.number,
                    },
                });
                return {
                    ...context,
                    externalPromptContext: {},
                };
            }

            const externalContext =
                await this.promptContextLoader.loadExternalContext({
                    organizationAndTeamData: context.organizationAndTeamData,
                    repository: context.repository,
                    pullRequest: context.pullRequest,
                    allReferences,
                });

            const totalReferencesLoaded = this.countLoadedReferences(
                externalContext,
            );

            this.logger.log({
                message: 'Successfully loaded external prompt context',
                context: this.stageName,
                metadata: {
                    organizationId,
                    repositoryId,
                    prNumber: context.pullRequest.number,
                    totalReferences: allReferences.length,
                    totalReferencesLoaded,
                },
            });

            return {
                ...context,
                externalPromptContext: externalContext,
            };
        } catch (error) {
            this.logger.error({
                message: 'Error loading external context',
                context: this.stageName,
                error,
                metadata: {
                    organizationAndTeamData: context.organizationAndTeamData,
                    prNumber: context.pullRequest.number,
                },
            });

            return {
                ...context,
                externalPromptContext: {},
            };
        }
    }

    private countLoadedReferences(context: any): number {
        let count = 0;

        if (context.customInstructions?.references) {
            count += context.customInstructions.references.length;
        }

        if (context.categories) {
            Object.values(context.categories).forEach((cat: any) => {
                if (cat?.references) {
                    count += cat.references.length;
                }
            });
        }

        if (context.severity) {
            Object.values(context.severity).forEach((sev: any) => {
                if (sev?.references) {
                    count += sev.references.length;
                }
            });
        }

        if (context.generation?.main?.references) {
            count += context.generation.main.references.length;
        }

        return count;
    }
}

