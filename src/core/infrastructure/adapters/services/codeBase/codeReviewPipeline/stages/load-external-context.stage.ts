import { createLogger } from "@kodus/flow";
import { Inject, Injectable } from '@nestjs/common';
import { BasePipelineStage } from '../../../pipeline/base-stage.abstract';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';
import type { ContextLayer } from '@context-os-core/interfaces';
import {
    IPromptExternalReferenceManagerService,
    PROMPT_EXTERNAL_REFERENCE_MANAGER_SERVICE_TOKEN,
} from '@/core/domain/prompts/contracts/promptExternalReferenceManager.contract';
import {
    IPromptContextLoaderService,
    PROMPT_CONTEXT_LOADER_SERVICE_TOKEN,
} from '@/core/domain/prompts/contracts/promptContextLoader.contract';
import { ILoadExternalContextStage } from './contracts/loadExternalContextStage.contract';
import { CodeReviewContextPackService } from '@/core/infrastructure/adapters/services/context/code-review-context-pack.service';

@Injectable()
export class LoadExternalContextStage
    extends BasePipelineStage<CodeReviewPipelineContext>
    implements ILoadExternalContextStage
{
    private readonly logger = createLogger(LoadExternalContextStage.name);
    readonly stageName = 'LoadExternalContextStage';

    constructor(
        @Inject(PROMPT_EXTERNAL_REFERENCE_MANAGER_SERVICE_TOKEN)
        private readonly promptReferenceManager: IPromptExternalReferenceManagerService,
        @Inject(PROMPT_CONTEXT_LOADER_SERVICE_TOKEN)
        private readonly promptContextLoader: IPromptContextLoaderService,
        private readonly contextPackService: CodeReviewContextPackService
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
                    context.organizationAndTeamData,
                    repositoryId,
                    directoryId,
                );

            const allReferences =
                await this.promptReferenceManager.findByConfigKeys(configKeys, {
                    contextReferenceId:
                        context.codeReviewConfig?.contextReferenceId,
                });

            const priorityMap = new Map(
                configKeys.map((key, index) => [key, index]),
            );

            const sortedReferences = [...(allReferences ?? [])].sort((a, b) => {
                const aPriority =
                    priorityMap.get(a.configKey) ?? Number.MAX_SAFE_INTEGER;
                const bPriority =
                    priorityMap.get(b.configKey) ?? Number.MAX_SAFE_INTEGER;
                return aPriority - bPriority;
            });

            let externalContext = {};
            let contextLayers: ContextLayer[] | undefined;

            if (sortedReferences.length > 0) {
                const loadResult =
                    await this.promptContextLoader.loadExternalContext(
                        {
                            organizationAndTeamData:
                                context.organizationAndTeamData,
                            repository: context.repository,
                            pullRequest: context.pullRequest,
                            allReferences: sortedReferences,
                        },
                        { buildLayers: true },
                    );

                externalContext = loadResult.externalContext;
                contextLayers = loadResult.contextLayers;
            }

            let sharedContextPack = undefined;
            let updatedCodeReviewConfig = context.codeReviewConfig;

            if (
                context.codeReviewConfig?.contextReferenceId &&
                (context.sharedContextPack?.metadata?.contextReferenceId ??
                    context.sharedContextPack?.metadata
                        ?.configContextReferenceId) !==
                    context.codeReviewConfig.contextReferenceId
            ) {
                try {
                    const resolved =
                        await this.contextPackService.buildContextPack({
                            organizationAndTeamData:
                                context.organizationAndTeamData,
                            overrides:
                                context.codeReviewConfig?.v2PromptOverrides,
                            contextReferenceId:
                                context.codeReviewConfig.contextReferenceId,
                            externalLayers: contextLayers,
                            repository: context.repository,
                            pullRequest: context.pullRequest,
                            executeMCPDependencies: false,
                        });

                    if (resolved.sanitizedOverrides) {
                        updatedCodeReviewConfig = {
                            ...context.codeReviewConfig,
                            v2PromptOverrides: resolved.sanitizedOverrides,
                        };
                    }

                    if (resolved.pack) {
                        sharedContextPack = resolved.pack;
                    }
                } catch (error) {
                    this.logger.warn({
                        message: 'Failed to build context pack',
                        context: this.stageName,
                        error,
                        metadata: {
                            organizationId,
                            contextReferenceId:
                                context.codeReviewConfig?.contextReferenceId,
                        },
                    });
                }
            }

            return {
                ...context,
                codeReviewConfig: updatedCodeReviewConfig,
                externalPromptContext: externalContext,
                externalPromptLayers: contextLayers,
                sharedContextPack,
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
                externalPromptLayers: undefined,
                sharedContextPack: undefined,
            };
        }
    }
}
