import { Inject, Injectable } from '@nestjs/common';
import { IKodyRule } from '@/core/domain/kodyRules/interfaces/kodyRules.interface';
import { AnalysisContext } from '@/config/types/general/codeReview.type';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { CodeManagementService } from '@/core/infrastructure/adapters/services/platformIntegration/codeManagement.service';
import {
    CONTEXT_REFERENCE_SERVICE_TOKEN,
    IContextReferenceService,
} from '@/core/domain/contextReferences/contracts/context-reference.service.contract';
import { CodeReviewContextPackService } from '@/core/infrastructure/adapters/services/context/code-review-context-pack.service';

export interface LoadedReference {
    filePath: string;
    content: string;
    description?: string;
}

export interface LoadedReferencesResult {
    referencesMap: Map<string, LoadedReference[]>;
    mcpResultsMap: Map<string, Record<string, unknown>>;
}

@Injectable()
export class ExternalReferenceLoaderService {
    constructor(
        private readonly codeManagementService: CodeManagementService,
        private readonly logger: PinoLoggerService,
        @Inject(CONTEXT_REFERENCE_SERVICE_TOKEN)
        private readonly contextReferenceService: IContextReferenceService,
        private readonly contextPackService: CodeReviewContextPackService,
    ) {}

    async loadReferences(
        rule: IKodyRule,
        context: AnalysisContext,
    ): Promise<{ references: LoadedReference[]; augmentations: Map<string, Record<string, unknown>> }> {
        // Load from context-references (Context OS)
        if (rule.contextReferenceId) {
            try {
                return await this.loadFromContextReference(rule, context);
            } catch (error) {
                this.logger.warn({
                    message: 'Failed to load from context-references',
                    context: ExternalReferenceLoaderService.name,
                    error,
                    metadata: {
                        ruleUuid: rule.uuid,
                        contextReferenceId: rule.contextReferenceId,
                    },
                });
                return { references: [], augmentations: new Map() };
            }
        }

        // No contextReferenceId - nothing to load
        this.logger.debug({
            message:
                'Rule has no contextReferenceId, skipping reference loading',
            context: ExternalReferenceLoaderService.name,
            metadata: {
                ruleUuid: rule.uuid,
            },
        });
        return { references: [], augmentations: new Map() };
    }

    private async loadFromContextReference(
        rule: IKodyRule,
        context: AnalysisContext,
    ): Promise<{ references: LoadedReference[]; augmentations: Map<string, Record<string, unknown>> }> {
        const packReferences = await this.tryLoadFromContextPack(
            rule,
            context,
        );
        if (packReferences.references.length) {
            return packReferences;
        }

        return await this.loadFromContextReferenceLegacy(rule, context);
    }

    private async tryLoadFromContextPack(
        rule: IKodyRule,
        context: AnalysisContext,
    ): Promise<{ references: LoadedReference[]; augmentations: Map<string, Record<string, unknown>> }> {
        if (!rule.contextReferenceId) {
            return { references: [], augmentations: new Map() };
        }

        try {
            const result = await this.contextPackService.buildContextPack({
                organizationAndTeamData: context.organizationAndTeamData,
                contextReferenceId: rule.contextReferenceId,
                repository: context.repository,
                pullRequest: context.pullRequest,
            });

            const layers = result.pack?.layers ?? [];
            const references: LoadedReference[] = [];
            for (const layer of layers) {
                const metadata = layer.metadata as Record<string, unknown>;
                if (metadata?.sourceType !== 'knowledge') {
                    continue;
                }
                if (Array.isArray(layer.content)) {
                    for (const entry of layer.content) {
                        if (
                            entry &&
                            typeof entry === 'object' &&
                            typeof (entry as Record<string, unknown>)
                                .filePath === 'string' &&
                            typeof (entry as Record<string, unknown>)
                                .content === 'string'
                        ) {
                            references.push({
                                filePath: (entry as Record<string, unknown>)
                                    .filePath as string,
                                content: (entry as Record<string, unknown>)
                                    .content as string,
                                description:
                                    typeof (entry as Record<string, unknown>)
                                        .description === 'string'
                                        ? ((entry as Record<string, unknown>)
                                              .description as string)
                                        : undefined,
                            });
                        }
                    }
                }
            }

            if (references.length) {
                this.logger.log({
                    message:
                        'Loaded references via Context Pack for Kody Rule context',
                    context: ExternalReferenceLoaderService.name,
                    metadata: {
                        ruleUuid: rule.uuid,
                        contextReferenceId: rule.contextReferenceId,
                        referencesCount: references.length,
                    },
                });
            }

            const augmentations = new Map<string, Record<string, unknown>>();
            if (result.augmentations) {
                for (const [pathKey, entry] of Object.entries(
                    result.augmentations,
                )) {
                    const outputs = entry.outputs ?? [];
                    outputs.forEach((output, index) => {
                        if (output.success && output.output) {
                            augmentations.set(
                                `${pathKey}::${index}`,
                                {
                                    provider: output.provider,
                                    toolName: output.toolName,
                                    output: output.output,
                                } as Record<string, unknown>,
                            );
                        }
                    });
                }
            }

            return { references, augmentations };
        } catch (error) {
            this.logger.warn({
                message:
                    'Failed to load references via Context Pack, falling back to legacy loader',
                context: ExternalReferenceLoaderService.name,
                error,
                metadata: {
                    ruleUuid: rule.uuid,
                    contextReferenceId: rule.contextReferenceId,
                },
            });
            return { references: [], augmentations: new Map() };
        }
    }

    private async loadFromContextReferenceLegacy(
        rule: IKodyRule,
        context: AnalysisContext,
    ): Promise<{ references: LoadedReference[]; augmentations: Map<string, Record<string, unknown>> }> {
        return { references: [], augmentations: new Map() };
    }

    private async fetchFileContent(
        filePath: string,
        lineRange: { start: number; end: number } | undefined,
        context: AnalysisContext,
    ): Promise<string | null> {
        try {
            const fileContent =
                await this.codeManagementService.getRepositoryContentFile({
                    organizationAndTeamData: context.organizationAndTeamData,
                    repository: {
                        id: context.repository.id || '',
                        name: context.repository.name || '',
                    },
                    file: { filename: filePath },
                    pullRequest: context.pullRequest,
                });

            if (!fileContent?.data?.content) {
                return null;
            }

            let content = fileContent.data.content;

            if (fileContent.data.encoding === 'base64') {
                content = Buffer.from(content, 'base64').toString('utf-8');
            }

            if (lineRange) {
                const extractedContent = this.extractLineRange(
                    content,
                    lineRange,
                );

                if (!extractedContent || extractedContent.trim().length === 0) {
                    this.logger.warn({
                        message:
                            'Line range extraction returned empty content, falling back to full file',
                        context: ExternalReferenceLoaderService.name,
                        metadata: {
                            filePath,
                            requestedRange: lineRange,
                            totalLines: content.split('\n').length,
                        },
                    });
                    // Fallback: use full file
                } else {
                    content = extractedContent;
                }
            }

            return content;
        } catch (error) {
            this.logger.error({
                message: 'Failed to fetch file content',
                context: ExternalReferenceLoaderService.name,
                error,
                metadata: {
                    filePath,
                    repository: context.repository?.name,
                },
            });
            return null;
        }
    }

    private extractLineRange(
        content: string,
        range: { start: number; end: number },
    ): string {
        const lines = content.split('\n');

        // Validação: range válido?
        if (range.start <= 0 || range.end <= 0 || range.start > range.end) {
            this.logger.warn({
                message: 'Invalid line range provided',
                context: ExternalReferenceLoaderService.name,
                metadata: { range },
            });
            return ''; // Retorna vazio para acionar fallback
        }

        // Validação: range fora do arquivo?
        if (range.start > lines.length) {
            this.logger.warn({
                message: 'Line range start exceeds file length',
                context: ExternalReferenceLoaderService.name,
                metadata: {
                    range,
                    totalLines: lines.length,
                },
            });
            return ''; // Retorna vazio para acionar fallback
        }

        const start = Math.max(0, range.start - 1);
        const end = Math.min(lines.length, range.end);
        return lines.slice(start, end).join('\n');
    }

    async loadReferencesForRules(
        rules: Partial<IKodyRule>[],
        context: AnalysisContext,
    ): Promise<LoadedReferencesResult> {
        const referencesMap = new Map<string, LoadedReference[]>();
        const mcpResultsMap = new Map<string, Record<string, unknown>>();

        for (const rule of rules) {
            if (rule.uuid) {
                const { references, augmentations } =
                    await this.loadReferences(rule as IKodyRule, context);
                if (references.length > 0) {
                    referencesMap.set(rule.uuid, references);
                }
                if (augmentations.size > 0) {
                    mcpResultsMap.set(
                        rule.uuid,
                        Object.fromEntries(augmentations),
                    );
                }
            }
        }

        const totalLoaded = Array.from(referencesMap.values()).reduce(
            (sum, refs) => sum + refs.length,
            0,
        );

        this.logger.log({
            message: 'Loaded external references for rules',
            context: ExternalReferenceLoaderService.name,
            metadata: {
                totalRules: rules.length,
                rulesWithReferences: referencesMap.size,
                totalReferencesLoaded: totalLoaded,
                organizationAndTeamData: context.organizationAndTeamData,
            },
        });

        return { referencesMap, mcpResultsMap };
    }
}
