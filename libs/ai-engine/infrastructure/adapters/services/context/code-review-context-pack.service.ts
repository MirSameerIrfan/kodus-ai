import { createHash } from 'crypto';

import type {
    ContextDependency,
    ContextLayer,
    ContextLayerBuilder,
    ContextPack,
    ContextRequirement,
    LayerInputContext,
    LayerBuildOptions,
    LayerBuildResult,
    MCPInvocationRequest,
    MCPInvocationResult,
    MCPRegistration,
    PackAssemblyStep,
} from '@context-os-core/interfaces';
import { MCPOrchestrator } from '@context-os-core/mcp/orchestrator';
import { InMemoryMCPRegistry } from '@context-os-core/mcp/registry';
import { SequentialPackAssemblyPipeline } from '@context-os-core/pipeline/sequential-pack-pipeline';
import {
    createMCPAdapter,
    type MCPServerConfig,
    createLogger,
} from '@kodus/flow';
import { Injectable } from '@nestjs/common';

import { PromptReferenceErrorType } from '@libs/ai-engine/domain/prompt/interfaces/promptExternalReference.interface';
import type { IPromptReferenceSyncError } from '@libs/ai-engine/domain/prompt/interfaces/promptExternalReference.interface';
import type {
    CodeReviewConfig,
    Repository,
    AnalysisContext,
} from '@libs/core/infrastructure/config/types/general/codeReview.type';
import type { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import {
    MCPToolMetadata,
    MCPToolMetadataService,
} from '@libs/mcp-server/services/mcp-tool-metadata.service';
import { CodeManagementService } from '@libs/platform/infrastructure/adapters/services/codeManagement.service';

import {
    CODE_REVIEW_CONTEXT_PATTERNS,
    pathToKey,
    stripMarkersFromText,
    tryParseJSON,
    normalizeProviderToolKey,
    resolveDependencyProvider,
    resolveDependencyToolName,
    deepClone,
} from './code-review-context.utils';
import { ContextReferenceService } from './context-reference.service';
import { formatMCPOutput } from './mcp-output-formatter';
import { MCPToolArgResolverAgentService } from './mcp-tool-arg-resolver-agent.service';

export interface ContextAugmentationOutput {
    provider?: string;
    toolName: string;
    success: boolean;
    output?: string;
    error?: string;
}

export type ContextAugmentationsMap = Record<
    string,
    {
        path: string[];
        requirementId?: string;
        outputs: ContextAugmentationOutput[];
    }
>;

export interface SkippedMCPTool {
    provider?: string;
    toolName?: string;
    requirementId?: string;
    path?: string[];
    missingArgs: string[];
    message: string;
}

interface BuildPackParams {
    organizationAndTeamData?: OrganizationAndTeamData;
    contextReferenceId?: string;
    overrides?: CodeReviewConfig['v2PromptOverrides'];
    externalLayers?: ContextLayer[];
    repository?: Partial<Repository>;
    pullRequest?: AnalysisContext['pullRequest'];
    executeMCPDependencies?: boolean;
}

interface BuildPackResult {
    sanitizedOverrides?: CodeReviewConfig['v2PromptOverrides'];
    augmentations?: ContextAugmentationsMap;
    pack?: ContextPack;
}

const DEFAULT_LAYER_INPUT: LayerInputContext = {
    domain: 'code',
    taskIntent: 'review',
    retrieval: {
        candidates: [],
    },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function resolveMCPArgs(
    request: MCPInvocationRequest,
): Record<string, unknown> {
    const metadata = (request.tool.metadata ?? {}) as Record<string, unknown>;
    const rawArgs = metadata.args;
    const args: Record<string, unknown> = isPlainObject(rawArgs)
        ? { ...(rawArgs as Record<string, unknown>) }
        : {};

    if (request.input && isPlainObject(request.input)) {
        if (isPlainObject(args.context)) {
            args.context = {
                ...(request.input as Record<string, unknown>),
                ...(args.context as Record<string, unknown>),
            };
        } else if (!Object.prototype.hasOwnProperty.call(args, 'context')) {
            args.context = request.input;
        } else {
            args.__context = request.input;
        }
    }

    return args;
}

class StaticLayerBuilder implements ContextLayerBuilder {
    public readonly stage = 'core' as unknown as ContextLayerBuilder['stage'];

    constructor(private readonly layerFactory: () => ContextLayer) {}

    async build(
        _input: LayerInputContext,
        _options?: LayerBuildOptions,
    ): Promise<LayerBuildResult> {
        return {
            layer: this.layerFactory(),
            resources: [],
        };
    }
}

class AdapterBackedMCPClient {
    constructor(
        private readonly adapter: ReturnType<typeof createMCPAdapter>,
        private readonly connectionRouting: Map<
            string,
            Map<string, MCPServerConfig>
        >,
    ) {}

    async invoke(request: MCPInvocationRequest): Promise<MCPInvocationResult> {
        const startedAt = Date.now();

        try {
            const serverConfig = this.resolveConnection(
                request.registry.id,
                request.tool.toolName,
            );
            const metadataServerName =
                request.registry.metadata &&
                typeof (request.registry.metadata as Record<string, unknown>)
                    .serverName === 'string'
                    ? ((request.registry.metadata as Record<string, unknown>)
                          .serverName as string)
                    : undefined;
            const serverName = serverConfig?.name ?? metadataServerName;
            const args = resolveMCPArgs(request);

            let result: unknown;
            if (serverName) {
                result = await this.adapter.executeTool(
                    request.tool.toolName,
                    args,
                    serverName,
                );
            } else {
                result = await this.adapter.executeTool(
                    request.tool.toolName,
                    args,
                );
            }

            return {
                success: true,
                output: result as Record<string, unknown> | string | null,
                latencyMs: Date.now() - startedAt,
            };
        } catch (error) {
            return {
                success: false,
                latencyMs: Date.now() - startedAt,
                error: {
                    message:
                        error instanceof Error ? error.message : String(error),
                },
            };
        }
    }

    private resolveConnection(
        providerId: string,
        toolName?: string,
    ): MCPServerConfig | undefined {
        const routing = this.connectionRouting.get(providerId);
        if (!routing) {
            return undefined;
        }

        if (toolName && routing.has(toolName)) {
            return routing.get(toolName);
        }

        return routing.get('*');
    }
}

@Injectable()
export class CodeReviewContextPackService {
    private readonly logger = createLogger(CodeReviewContextPackService.name);
    constructor(
        private readonly contextReferenceService: ContextReferenceService,
        private readonly mcpToolMetadataService: MCPToolMetadataService,
        private readonly mcpToolArgResolver: MCPToolArgResolverAgentService,
        private readonly codeManagementService: CodeManagementService,
    ) {}

    async buildContextPack(params: BuildPackParams): Promise<BuildPackResult> {
        const {
            organizationAndTeamData,
            contextReferenceId,
            overrides,
            executeMCPDependencies,
        } = params;
        const shouldExecuteMCP =
            typeof executeMCPDependencies === 'boolean'
                ? executeMCPDependencies
                : true;

        let processedOverrides = overrides
            ? (JSON.parse(
                  JSON.stringify(overrides),
              ) as CodeReviewConfig['v2PromptOverrides'])
            : undefined;

        if (!contextReferenceId || !organizationAndTeamData?.organizationId) {
            return {
                sanitizedOverrides: this.sanitizeOverrides(processedOverrides),
            };
        }

        const reference =
            await this.contextReferenceService.findById(contextReferenceId);

        if (!reference) {
            return {
                sanitizedOverrides: this.sanitizeOverrides(processedOverrides),
            };
        }

        const requirements = reference.requirements ?? [];
        const { mcpDependencies, knowledgeDependencies } =
            this.buildDependencyGroups(requirements);
        const hasPackContent =
            Boolean(processedOverrides) ||
            mcpDependencies.length > 0 ||
            knowledgeDependencies.length > 0 ||
            (params.externalLayers?.length ?? 0) > 0;

        if (!hasPackContent) {
            return {
                sanitizedOverrides: this.sanitizeOverrides(processedOverrides),
            };
        }

        const metadataLoad = mcpDependencies.length
            ? await this.mcpToolMetadataService.loadMetadataForOrganization(
                  organizationAndTeamData,
              )
            : {
                  connections: [] as MCPServerConfig[],
                  metadata: new Map<string, MCPToolMetadata>(),
              };

        const connections = metadataLoad.connections;
        const metadata = metadataLoad.metadata;

        const syncErrors: IPromptReferenceSyncError[] = [];
        const skippedDependencies: SkippedMCPTool[] = [];

        const tempPack = await this.assemblePackFromPipeline({
            contextReferenceId,
            instructionsLayer: processedOverrides
                ? this.createInstructionsLayer(
                      contextReferenceId,
                      processedOverrides,
                  )
                : undefined,
            externalLayers: params.externalLayers,
        });

        const knowledgeResolution = knowledgeDependencies.length
            ? await this.resolveKnowledgeDependencies({
                  contextReferenceId,
                  dependencies: knowledgeDependencies,
                  organizationAndTeamData,
                  repository: params.repository,
                  pullRequest: params.pullRequest,
              })
            : {
                  layers: [],
                  items: [],
                  errors: [] as IPromptReferenceSyncError[],
              };

        if (knowledgeResolution.layers.length) {
            for (const layer of knowledgeResolution.layers) {
                tempPack.layers.push(this.cloneLayer(layer));
            }
        }

        let resolvedDependencies = mcpDependencies;
        if (shouldExecuteMCP && mcpDependencies.length > 0) {
            const resolution = await this.resolveMCPDependenciesForPack({
                dependencies: mcpDependencies,
                pack: tempPack,
                organizationAndTeamData,
                toolMetadata: metadata,
            });
            resolvedDependencies = resolution.resolvedDependencies;
            skippedDependencies.push(...resolution.skippedDependencies);
        }

        let augmentations: ContextAugmentationsMap | undefined;
        if (
            shouldExecuteMCP &&
            resolvedDependencies.length > 0 &&
            connections?.length > 0
        ) {
            const {
                augmentations: execAugmentations,
                syncErrors: execSyncErrors,
            } = await this.executeDependencies({
                contextReferenceId,
                connections,
                dependencies: resolvedDependencies,
                pack: tempPack,
            });

            augmentations = execAugmentations;
            if (execSyncErrors?.length) {
                syncErrors.push(...execSyncErrors);
            }

            if (augmentations && Object.keys(augmentations).length > 0) {
                this.logger.debug({
                    message: 'MCP marker replacement: starting replacement',
                    context: CodeReviewContextPackService.name,
                    metadata: {
                        augmentationsKeys: Object.keys(augmentations),
                        dependenciesCount: resolvedDependencies.length,
                        hasProcessedOverrides: !!processedOverrides,
                    },
                });

                processedOverrides = this.replaceMCPMarkersInOverrides(
                    processedOverrides,
                    augmentations,
                    resolvedDependencies,
                );

                this.logger.debug({
                    message: 'MCP marker replacement: replacement completed',
                    context: CodeReviewContextPackService.name,
                });
            }
        } else if (!shouldExecuteMCP && mcpDependencies.length > 0) {
            this.logger.debug({
                message:
                    'Context pack has MCP dependencies but execution was skipped',
                context: CodeReviewContextPackService.name,
                metadata: {
                    contextReferenceId,
                    dependenciesCount: mcpDependencies.length,
                },
            });
        } else if (
            resolvedDependencies.length > 0 &&
            (!connections || !connections.length)
        ) {
            const message =
                'Context pack found MCP dependencies but no MCP connections/metadata were available during execution.';
            this.logger.error({
                message,
                context: CodeReviewContextPackService.name,
                metadata: {
                    contextReferenceId,
                    dependencies: resolvedDependencies
                        .slice(0, 10)
                        .map((dep) => ({
                            id: dep.id,
                            provider: resolveDependencyProvider(dep),
                            toolName: resolveDependencyToolName(dep),
                            requirementId: this.resolveRequirementId(dep),
                        })),
                    totalDependencies: resolvedDependencies.length,
                    omittedDependencies: Math.max(
                        0,
                        resolvedDependencies.length - 10,
                    ),
                },
            });

            for (const dependency of resolvedDependencies) {
                syncErrors.push({
                    type: PromptReferenceErrorType.MCP_CONNECTION_FAILED,
                    message: `${message} Tool=${resolveDependencyToolName(dependency) ?? 'unknown'} Provider=${resolveDependencyProvider(dependency) ?? 'unknown'} Requirement=${this.resolveRequirementId(dependency) ?? 'n/a'}`,
                    details: {
                        timestamp: new Date(),
                    },
                });
            }
        }

        const instructionsLayer = this.createInstructionsLayer(
            contextReferenceId,
            processedOverrides,
        );

        const pack = await this.assemblePackFromPipeline({
            contextReferenceId,
            instructionsLayer,
            externalLayers: params.externalLayers,
        });

        if (knowledgeResolution.layers.length) {
            for (const layer of knowledgeResolution.layers) {
                pack.layers.push(this.cloneLayer(layer));
            }
        }

        const combinedDependencies = [
            ...resolvedDependencies,
            ...knowledgeDependencies,
        ];
        pack.dependencies = combinedDependencies;
        const combinedSyncErrors = [
            ...knowledgeResolution.errors,
            ...syncErrors,
        ];
        pack.metadata = {
            ...(pack.metadata ?? {}),
            contextReferenceId,
            configContextReferenceId: reference.metadata?.contextReferenceId,
            requirementIds: requirements.map((req) => req.id),
            knowledgeItemsCount: knowledgeResolution.items.length,
            knowledgeErrors: knowledgeResolution.errors,
            mcpErrors: syncErrors,
        };

        try {
            await this.contextReferenceService.update(
                { uuid: contextReferenceId },
                {
                    metadata: {
                        ...(reference.metadata ?? {}),
                        syncErrors: combinedSyncErrors,
                    },
                    lastProcessedAt: new Date(),
                },
            );
        } catch (error) {
            this.logger.error({
                message:
                    'Failed to persist sync errors back to context reference',
                context: CodeReviewContextPackService.name,
                error,
                metadata: {
                    contextReferenceId,
                    syncErrorsCount: combinedSyncErrors.length,
                },
            });
        }

        if (augmentations && Object.keys(augmentations).length > 0) {
            pack.layers.push(
                this.createAugmentationsLayer(
                    contextReferenceId,
                    augmentations,
                ),
            );
        }

        const sanitizedOverrides = processedOverrides;

        return {
            sanitizedOverrides,
            augmentations,
            pack,
        };
    }

    private sanitizeOverrides(
        overrides?: CodeReviewConfig['v2PromptOverrides'],
    ): CodeReviewConfig['v2PromptOverrides'] | undefined {
        if (!overrides) {
            return undefined;
        }

        const clone = JSON.parse(
            JSON.stringify(overrides),
        ) as CodeReviewConfig['v2PromptOverrides'];

        const sanitizeRecursive = (node: unknown): unknown => {
            if (typeof node === 'string') {
                return stripMarkersFromText(node, CODE_REVIEW_CONTEXT_PATTERNS);
            }

            if (Array.isArray(node)) {
                return node.map((item) => sanitizeRecursive(item));
            }

            if (node && typeof node === 'object') {
                const candidate = node as Record<string, unknown>;

                if (candidate.type === 'mcpMention') {
                    return node;
                }

                const result: Record<string, unknown> = {};
                for (const [key, value] of Object.entries(candidate)) {
                    result[key] = sanitizeRecursive(value);
                }
                return result;
            }

            return node;
        };

        return sanitizeRecursive(
            clone,
        ) as CodeReviewConfig['v2PromptOverrides'];
    }

    private replaceMCPMarkersInOverrides(
        overrides: CodeReviewConfig['v2PromptOverrides'] | undefined,
        augmentations: ContextAugmentationsMap,
        dependencies: ContextDependency[],
    ): CodeReviewConfig['v2PromptOverrides'] | undefined {
        if (!overrides) {
            return undefined;
        }

        const clone = JSON.parse(
            JSON.stringify(overrides),
        ) as CodeReviewConfig['v2PromptOverrides'];

        const dependencyMap = new Map<string, ContextDependency>();
        for (const dep of dependencies) {
            const provider = resolveDependencyProvider(dep);
            const toolName = resolveDependencyToolName(dep);
            if (provider && toolName) {
                dependencyMap.set(`${provider}|${toolName}`, dep);
            }
        }

        const { resultsMap, errorsMap } = this.buildToolResultMaps(
            augmentations,
            dependencyMap,
        );

        const lookup = (provider: string, tool: string) => {
            const normalized = normalizeProviderToolKey(provider, tool);

            let result = resultsMap.get(normalized);
            let error = errorsMap.get(normalized);

            if (result || error) {
                return { result, error };
            }

            const dep =
                dependencyMap.get(normalized) ??
                dependencyMap.get(`${provider}|${tool}`);

            if (dep) {
                const providerAlias = dep.metadata?.providerAlias as
                    | string
                    | undefined;
                const toolNameAlias = dep.metadata?.toolNameAlias as
                    | string
                    | undefined;

                const aliasKeys = this.generateNormalizedKeys(
                    provider,
                    tool,
                    providerAlias,
                    toolNameAlias,
                );

                for (const key of aliasKeys) {
                    result = resultsMap.get(key);
                    error = errorsMap.get(key);
                    if (result || error) {
                        return { result, error };
                    }
                }

                const realProvider = resolveDependencyProvider(dep);
                const realToolName = resolveDependencyToolName(dep);
                if (realProvider && realToolName) {
                    const realKey = normalizeProviderToolKey(
                        realProvider,
                        realToolName,
                    );
                    result = resultsMap.get(realKey);
                    error = errorsMap.get(realKey);
                    if (result || error) {
                        return { result, error };
                    }
                }
            }

            return { result: undefined, error: undefined };
        };

        const replaceRecursive = (node: unknown): unknown => {
            if (typeof node === 'string') {
                const parsed = tryParseJSON(node);
                if (parsed !== null) {
                    const processed = replaceRecursive(parsed);
                    if (processed !== parsed) {
                        return JSON.stringify(processed);
                    }
                }
                return this.replaceMarkersInString(node, lookup);
            }

            if (Array.isArray(node)) {
                const replaced: unknown[] = [];
                for (const item of node) {
                    if (
                        item &&
                        typeof item === 'object' &&
                        (item as Record<string, unknown>).type === 'mcpMention'
                    ) {
                        const replacedNode = this.replaceMCPMentionNode(
                            item as Record<string, unknown>,
                            lookup,
                        );
                        if (
                            replacedNode !== null &&
                            replacedNode !== undefined
                        ) {
                            replaced.push(replacedNode);
                        }
                        continue;
                    }
                    const replacedItem = replaceRecursive(item);
                    if (replacedItem !== null && replacedItem !== undefined) {
                        replaced.push(replacedItem);
                    }
                }
                return replaced;
            }

            if (node && typeof node === 'object') {
                const candidate = node as Record<string, unknown>;

                if (candidate.type === 'mcpMention') {
                    return this.replaceMCPMentionNode(candidate, lookup);
                }

                const result: Record<string, unknown> = {};
                for (const [key, value] of Object.entries(candidate)) {
                    const replaced = replaceRecursive(value);
                    if (replaced !== null && replaced !== undefined) {
                        result[key] = replaced;
                    }
                }
                return result;
            }

            return node;
        };

        return replaceRecursive(clone) as CodeReviewConfig['v2PromptOverrides'];
    }

    private generateNormalizedKeys(
        provider: string,
        toolName: string,
        providerAlias?: string,
        toolNameAlias?: string,
    ): Set<string> {
        const keys = new Set<string>();

        keys.add(normalizeProviderToolKey(provider, toolName));

        if (providerAlias) {
            keys.add(normalizeProviderToolKey(providerAlias, toolName));
        }

        if (toolNameAlias) {
            keys.add(normalizeProviderToolKey(provider, toolNameAlias));
        }

        if (providerAlias && toolNameAlias) {
            keys.add(normalizeProviderToolKey(providerAlias, toolNameAlias));
        }

        return keys;
    }

    private buildToolResultMaps(
        augmentations: ContextAugmentationsMap,
        dependencyMap: Map<string, ContextDependency>,
    ): {
        resultsMap: Map<string, string>;
        errorsMap: Map<string, string>;
    } {
        const resultsMap = new Map<string, string>();
        const errorsMap = new Map<string, string>();

        for (const augmentation of Object.values(augmentations)) {
            for (const output of augmentation.outputs) {
                if (!output.provider || !output.toolName) {
                    continue;
                }

                const normalizedKey = normalizeProviderToolKey(
                    output.provider,
                    output.toolName,
                );
                const dep =
                    dependencyMap.get(normalizedKey) ??
                    dependencyMap.get(`${output.provider}|${output.toolName}`);

                const providerAlias = dep?.metadata?.providerAlias as
                    | string
                    | undefined;
                const toolNameAlias = dep?.metadata?.toolNameAlias as
                    | string
                    | undefined;

                const keys = this.generateNormalizedKeys(
                    output.provider,
                    output.toolName,
                    providerAlias,
                    toolNameAlias,
                );

                if (output.success && output.output) {
                    for (const key of keys) {
                        resultsMap.set(key, output.output);
                    }
                } else if (output.error) {
                    for (const key of keys) {
                        errorsMap.set(key, output.error);
                    }
                }
            }
        }

        return { resultsMap, errorsMap };
    }

    private replaceMarkersInString(
        text: string,
        lookup: (
            provider: string,
            tool: string,
        ) => {
            result?: string;
            error?: string;
        },
    ): string {
        const markerRegex = /@mcp<([^|>]+)\|([^>]+)>/gi;
        const matches: Array<{
            marker: string;
            provider: string;
            tool: string;
        }> = [];

        let match: RegExpExecArray | null;
        while ((match = markerRegex.exec(text)) !== null) {
            matches.push({
                marker: match[0],
                provider: match[1].trim(),
                tool: match[2].trim(),
            });
        }

        if (matches.length > 0) {
            this.logger.debug({
                message: 'MCP marker replacement: found markers in string',
                context: CodeReviewContextPackService.name,
                metadata: {
                    matchesCount: matches.length,
                    matches: matches.map((m) => ({
                        marker: m.marker,
                        provider: m.provider,
                        tool: m.tool,
                    })),
                },
            });
        }

        let result = text;
        for (let i = matches.length - 1; i >= 0; i--) {
            const { marker, provider, tool } = matches[i];
            const normalized = normalizeProviderToolKey(provider, tool);
            const { result: replacement, error } = lookup(provider, tool);

            this.logger.debug({
                message: 'MCP marker replacement: attempting lookup',
                context: CodeReviewContextPackService.name,
                metadata: {
                    marker,
                    provider,
                    tool,
                    normalized,
                    foundResult: !!replacement,
                    foundError: !!error,
                },
            });

            if (replacement) {
                result = result.replace(marker, replacement);
                this.logger.debug({
                    message: 'MCP marker replacement: SUCCESS',
                    context: CodeReviewContextPackService.name,
                    metadata: {
                        // Truncate sensitive or potentially large data
                        marker: marker.substring(0, 100),
                        provider,
                        tool,
                        replacementLength: replacement.length,
                    },
                });
            } else if (error) {
                result = result.replace(
                    marker,
                    `[MCP Tool ${tool} failed: ${error}]`,
                );
            }
        }

        return result;
    }

    private replaceMCPMentionNode(
        node: Record<string, unknown>,
        lookup: (
            provider: string,
            tool: string,
        ) => {
            result?: string;
            error?: string;
        },
    ): unknown {
        const attrs = node.attrs as Record<string, unknown> | undefined;
        const provider = typeof attrs?.app === 'string' ? attrs.app : undefined;
        const toolName =
            typeof attrs?.tool === 'string' ? attrs.tool : undefined;

        if (!provider || !toolName) {
            return node;
        }

        const normalized = normalizeProviderToolKey(provider, toolName);
        const { result, error } = lookup(provider, toolName);

        this.logger.debug({
            message: 'MCP marker replacement: processing mcpMention node',
            context: CodeReviewContextPackService.name,
            metadata: {
                provider,
                toolName,
                normalized,
                foundResult: !!result,
                foundError: !!error,
            },
        });

        if (result || error) {
            const replacement =
                result ?? `[MCP Tool ${toolName} failed: ${error}]`;
            return {
                ...node,
                attrs: {
                    ...(node.attrs as Record<string, unknown>),
                    resolvedOutput: replacement,
                    lastUpdatedAt: Date.now(),
                },
            };
        }

        return node;
    }

    private buildDependencyGroups(requirements: ContextRequirement[]): {
        mcpDependencies: ContextDependency[];
        knowledgeDependencies: ContextDependency[];
    } {
        const mcpDependencies: ContextDependency[] = [];
        const knowledgeDependencies: ContextDependency[] = [];
        const mcpDedupe = new Set<string>();
        const knowledgeDedupe = new Set<string>();

        for (const requirement of requirements) {
            const path = this.resolveRequirementPath(requirement);
            const pathKey = pathToKey(path);

            for (const dependency of requirement.dependencies ?? []) {
                if (!dependency) {
                    continue;
                }

                if (dependency.type === 'mcp') {
                    const provider = resolveDependencyProvider(dependency);
                    const toolName = resolveDependencyToolName(dependency);
                    if (!provider || !toolName) {
                        continue;
                    }

                    const uniqueKey = `${pathKey}::${provider}::${toolName}`;
                    if (mcpDedupe.has(uniqueKey)) {
                        continue;
                    }
                    mcpDedupe.add(uniqueKey);

                    const metadata = {
                        ...(dependency.metadata ?? {}),
                        provider,
                        toolName,
                        path,
                        pathKey,
                        requirementId: requirement.id,
                    };

                    const descriptor = this.buildDescriptor(
                        dependency.descriptor,
                        provider,
                        toolName,
                        metadata,
                    );

                    mcpDependencies.push({
                        type: 'mcp',
                        id: `${provider}|${toolName}`,
                        descriptor,
                        metadata,
                    });
                } else if (dependency.type === 'knowledge') {
                    const filePath = dependency.metadata?.filePath as
                        | string
                        | undefined;
                    if (!filePath) {
                        continue;
                    }

                    const repositoryName = dependency.metadata
                        ?.repositoryName as string | undefined;
                    const repositoryId = dependency.metadata?.repositoryId as
                        | string
                        | undefined;

                    const knowledgeKey = `${repositoryName ?? repositoryId ?? 'default'}::${filePath}`;
                    if (knowledgeDedupe.has(knowledgeKey)) {
                        continue;
                    }
                    knowledgeDedupe.add(knowledgeKey);

                    const metadata = {
                        ...(dependency.metadata ?? {}),
                        filePath,
                        repositoryName,
                        repositoryId,
                        path,
                        pathKey,
                        requirementId: requirement.id,
                    };

                    knowledgeDependencies.push({
                        type: 'knowledge',
                        id: dependency.id || knowledgeKey,
                        descriptor: dependency.descriptor,
                        metadata,
                    });
                }
            }
        }

        return {
            mcpDependencies,
            knowledgeDependencies,
        };
    }

    private buildDescriptor(
        currentDescriptor: unknown,
        provider: string,
        toolName: string,
        metadata: Record<string, unknown>,
    ): unknown {
        if (
            currentDescriptor &&
            typeof currentDescriptor === 'object' &&
            isPlainObject(currentDescriptor) &&
            typeof (currentDescriptor as Record<string, unknown>).mcpId ===
                'string' &&
            typeof (currentDescriptor as Record<string, unknown>).toolName ===
                'string'
        ) {
            const descriptor = currentDescriptor as Record<string, unknown>;
            const existingMetadata = isPlainObject(descriptor.metadata)
                ? (descriptor.metadata as Record<string, unknown>)
                : {};
            return {
                ...descriptor,
                mcpId: provider,
                toolName,
                metadata: {
                    ...existingMetadata,
                    ...metadata,
                },
            };
        }

        return {
            mcpId: provider,
            toolName,
            metadata,
        };
    }

    private async resolveMCPDependenciesForPack(params: {
        dependencies: ContextDependency[];
        pack: ContextPack;
        organizationAndTeamData?: OrganizationAndTeamData;
        toolMetadata: Map<string, MCPToolMetadata>;
    }): Promise<{
        resolvedDependencies: ContextDependency[];
        skippedDependencies: SkippedMCPTool[];
    }> {
        const { dependencies, pack, organizationAndTeamData, toolMetadata } =
            params;
        const resolvedDependencies: ContextDependency[] = [];
        const skippedDependencies: SkippedMCPTool[] = [];

        for (const dependency of dependencies) {
            try {
                const enrichedDependency = this.applyToolMetadata(
                    dependency,
                    toolMetadata,
                );

                const resolution = await this.mcpToolArgResolver.resolveArgs({
                    dependency: enrichedDependency,
                    organizationAndTeamData,
                    pack,
                    input: DEFAULT_LAYER_INPUT,
                    runtime: undefined,
                });

                if (resolution.missingArgs.length === 0) {
                    const resolvedDependency: ContextDependency = {
                        ...enrichedDependency,
                        metadata: {
                            ...(enrichedDependency.metadata ?? {}),
                            args: resolution.args,
                            argsSources: {
                                _agent: `resolved with confidence ${resolution.confidence}`,
                            },
                        },
                    };
                    resolvedDependencies.push(resolvedDependency);
                    continue;
                }

                const provider = resolveDependencyProvider(enrichedDependency);
                const toolName = resolveDependencyToolName(enrichedDependency);
                const requirementId =
                    this.resolveRequirementId(enrichedDependency);
                const path = this.resolveDependencyPath(enrichedDependency);

                const message = `MCP tool ${provider ?? 'unknown'}::${
                    toolName ?? 'unknown'
                } not executed. Missing arguments: ${
                    resolution.missingArgs.join(', ') || 'unknown'
                }. Confidence: ${resolution.confidence.toFixed(2)}`;

                this.logger.warn({
                    message,
                    context: CodeReviewContextPackService.name,
                    metadata: {
                        provider,
                        toolName,
                        requirementId,
                        missingArgs: resolution.missingArgs,
                        path,
                        confidence: resolution.confidence,
                        severity: 'warning',
                    },
                });

                skippedDependencies.push({
                    provider,
                    toolName,
                    requirementId,
                    path,
                    missingArgs: resolution.missingArgs,
                    message,
                });
            } catch (error) {
                const provider = resolveDependencyProvider(dependency);
                const toolName = resolveDependencyToolName(dependency);

                this.logger.error({
                    message:
                        'Error resolving arguments for MCP tool before execution',
                    context: CodeReviewContextPackService.name,
                    error,
                    metadata: {
                        provider,
                        toolName,
                        requirementId: this.resolveRequirementId(dependency),
                    },
                });

                skippedDependencies.push({
                    provider,
                    toolName,
                    requirementId: this.resolveRequirementId(dependency),
                    path: this.resolveDependencyPath(dependency),
                    missingArgs: [],
                    message:
                        'Internal failure while preparing arguments for MCP tool.',
                });
            }
        }

        return { resolvedDependencies, skippedDependencies };
    }

    private async resolveKnowledgeDependencies(params: {
        contextReferenceId: string;
        dependencies: ContextDependency[];
        organizationAndTeamData?: OrganizationAndTeamData;
        repository?: Partial<Repository>;
        pullRequest?: AnalysisContext['pullRequest'];
    }): Promise<{
        layers: ContextLayer[];
        items: Array<{
            dependencyId: string;
            filePath: string;
            repositoryId?: string;
            repositoryName?: string;
            content: string;
            lineRange?: { start: number; end: number };
            description?: string;
            tokens: number;
            hash: string;
        }>;
        errors: IPromptReferenceSyncError[];
    }> {
        const { contextReferenceId, dependencies, organizationAndTeamData } =
            params;

        const resolvedItems: Array<{
            dependencyId: string;
            filePath: string;
            repositoryId?: string;
            repositoryName?: string;
            content: string;
            lineRange?: { start: number; end: number };
            description?: string;
            tokens: number;
            hash: string;
        }> = [];
        const errors: IPromptReferenceSyncError[] = [];
        const dedupe = new Set<string>();

        for (const dependency of dependencies) {
            const filePath = dependency.metadata?.filePath as
                | string
                | undefined;
            if (!filePath) {
                continue;
            }

            const rawRepositoryName =
                (dependency.metadata?.repositoryName as string | undefined) ??
                params.repository?.name;
            const rawRepositoryId =
                (dependency.metadata?.repositoryId as string | undefined) ??
                params.repository?.id;

            const repositoryName = rawRepositoryName?.trim();
            const repositoryId = rawRepositoryId?.trim();
            const description = dependency.metadata?.description as
                | string
                | undefined;
            const lineRange = dependency.metadata?.lineRange as
                | { start: number; end: number }
                | undefined;

            const uniqueKey = `${repositoryName ?? repositoryId ?? 'default'}::${filePath}::${lineRange?.start ?? 'all'}-${lineRange?.end ?? 'all'}`;
            if (dedupe.has(uniqueKey)) {
                continue;
            }
            dedupe.add(uniqueKey);

            const dependencyMetadata =
                (dependency.metadata as Record<string, unknown>) ?? {};
            if (repositoryName) {
                dependencyMetadata.repositoryName = repositoryName;
            }
            if (repositoryId) {
                dependencyMetadata.repositoryId = repositoryId;
            }
            dependency.metadata = dependencyMetadata;

            try {
                const content = await this.fetchKnowledgeContent({
                    filePath,
                    repositoryId,
                    repositoryName,
                    organizationAndTeamData,
                    repositoryFallback: params.repository,
                    pullRequest: params.pullRequest,
                    lineRange,
                });

                if (!content) {
                    errors.push({
                        type: PromptReferenceErrorType.FILE_NOT_FOUND,
                        message: `File not found: ${filePath}`,
                        details: {
                            fileName: filePath,
                            repositoryName:
                                repositoryName ?? params.repository?.name,
                            timestamp: new Date(),
                        },
                    });
                    continue;
                }

                const tokens = this.estimateTokens(content);
                const hash = this.calculateContentHash(content);

                resolvedItems.push({
                    dependencyId: dependency.id as string,
                    filePath,
                    repositoryId: repositoryId ?? params.repository?.id,
                    repositoryName: repositoryName ?? params.repository?.name,
                    content,
                    lineRange,
                    description,
                    tokens,
                    hash,
                });
            } catch (error) {
                this.logger.error({
                    message:
                        'Failed to resolve knowledge dependency for context pack',
                    context: CodeReviewContextPackService.name,
                    error,
                    metadata: {
                        filePath,
                        repositoryId,
                        repositoryName,
                        contextReferenceId,
                    },
                });

                errors.push({
                    type: PromptReferenceErrorType.FETCH_FAILED,
                    message: `Error loading knowledge dependency: ${filePath}`,
                    details: {
                        fileName: filePath,
                        repositoryName:
                            repositoryName ?? params.repository?.name,
                        timestamp: new Date(),
                    },
                });
            }
        }

        if (!resolvedItems.length) {
            return { layers: [], items: [], errors };
        }

        const knowledgeLayer: ContextLayer = {
            id: `${contextReferenceId}::knowledge`,
            kind: 'catalog',
            priority: 1,
            tokens: resolvedItems.reduce((sum, item) => sum + item.tokens, 0),
            content: resolvedItems.map((item) => ({
                id: item.dependencyId,
                filePath: item.filePath,
                repositoryId: item.repositoryId,
                repositoryName: item.repositoryName,
                lineRange: item.lineRange,
                description: item.description,
                content: item.content,
                tokens: item.tokens,
                hash: item.hash,
            })),
            references: resolvedItems.map((item) => ({
                itemId: item.dependencyId,
            })),
            metadata: {
                contextReferenceId,
                type: 'knowledge',
                itemsCount: resolvedItems.length,
                sourceType: 'knowledge',
            },
        };

        return {
            layers: [knowledgeLayer],
            items: resolvedItems,
            errors,
        };
    }

    private async fetchKnowledgeContent(params: {
        filePath: string;
        repositoryId?: string;
        repositoryName?: string;
        repositoryFallback?: Partial<Repository>;
        organizationAndTeamData?: OrganizationAndTeamData;
        pullRequest?: AnalysisContext['pullRequest'];
        lineRange?: { start: number; end: number };
    }): Promise<string | null> {
        const {
            filePath,
            repositoryId,
            repositoryName,
            repositoryFallback,
            organizationAndTeamData,
            pullRequest,
            lineRange,
        } = params;

        const repoName = repositoryName ?? repositoryFallback?.name;
        const repoId = repositoryId ?? repositoryFallback?.id ?? '';

        if (!repoName) {
            return null;
        }

        const response =
            await this.codeManagementService.getRepositoryContentFile({
                organizationAndTeamData,
                repository: {
                    id: repoId,
                    name: repoName,
                },
                file: { filename: filePath },
                pullRequest: pullRequest as any,
            });

        let content = response?.data?.content;
        if (!content) {
            return null;
        }

        if (response?.data?.encoding === 'base64') {
            content = Buffer.from(content, 'base64').toString('utf-8');
        }

        if (lineRange) {
            const extracted = this.extractLineRange(content, lineRange);
            if (extracted && extracted.trim().length > 0) {
                content = extracted;
            }
        }

        return content;
    }

    private extractLineRange(
        content: string,
        range: { start: number; end: number },
    ): string {
        const lines = content.split('\n');

        if (range.start <= 0 || range.end <= 0 || range.start > range.end) {
            this.logger.warn({
                message: 'Invalid line range provided for knowledge dependency',
                context: CodeReviewContextPackService.name,
                metadata: { range },
            });
            return '';
        }

        if (range.start > lines.length) {
            this.logger.warn({
                message:
                    'Line range start exceeds file length for knowledge dependency',
                context: CodeReviewContextPackService.name,
                metadata: { range, totalLines: lines.length },
            });
            return '';
        }

        const start = Math.max(0, range.start - 1);
        const end = Math.min(lines.length, range.end);
        return lines.slice(start, end).join('\n');
    }

    private estimateTokens(content: string): number {
        if (!content) {
            return 0;
        }
        return Math.max(1, Math.ceil(content.length / 4));
    }

    private calculateContentHash(content: string): string {
        return createHash('sha256').update(content).digest('hex');
    }

    private resolveConnectionProviderId(
        connection: MCPServerConfig,
    ): string | undefined {
        const candidates = [
            connection.provider,
            connection.name,
            connection.url,
        ];

        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim().length > 0) {
                return candidate.trim();
            }
        }

        return undefined;
    }

    private applyToolMetadata(
        dependency: ContextDependency,
        metadataMap: Map<string, MCPToolMetadata>,
    ): ContextDependency {
        const provider = resolveDependencyProvider(dependency);
        const toolName = resolveDependencyToolName(dependency);

        if (!provider || !toolName) {
            return dependency;
        }

        const metadataEntry = this.mcpToolMetadataService.resolveToolMetadata(
            metadataMap,
            provider,
            toolName,
        );
        const resolvedProvider = metadataEntry?.providerId ?? provider;
        const resolvedToolName = metadataEntry?.toolName ?? toolName;
        const metadata = metadataEntry?.metadata;

        if (!metadata) {
            return {
                ...dependency,
                id: `${resolvedProvider}|${resolvedToolName}`,
                metadata: {
                    ...(dependency.metadata ?? {}),
                    provider: resolvedProvider,
                    toolName: resolvedToolName,
                    ...(resolvedProvider !== provider
                        ? { providerAlias: provider }
                        : {}),
                    ...(resolvedToolName !== toolName
                        ? { toolNameAlias: toolName }
                        : {}),
                },
            };
        }

        const currentMetadata = (dependency.metadata ?? {}) as Record<
            string,
            unknown
        >;
        const existingRequired = Array.isArray(currentMetadata.requiredArgs)
            ? (currentMetadata.requiredArgs as string[])
            : [];
        const mergedRequired = Array.from(
            new Set([...existingRequired, ...metadata.requiredArgs]),
        );

        const mergedMetadata = {
            ...currentMetadata,
            requiredArgs: mergedRequired,
            toolInputSchema: metadata.inputSchema,
            provider: resolvedProvider,
            toolName: resolvedToolName,
        } as Record<string, unknown>;

        if (
            resolvedProvider &&
            provider &&
            resolvedProvider !== provider &&
            !mergedMetadata.providerAlias
        ) {
            mergedMetadata.providerAlias = provider;
        }

        if (
            resolvedToolName &&
            toolName &&
            resolvedToolName !== toolName &&
            !mergedMetadata.toolNameAlias
        ) {
            mergedMetadata.toolNameAlias = toolName;
        }

        let descriptor = dependency.descriptor;
        if (descriptor && typeof descriptor === 'object') {
            const descriptorRecord = descriptor as Record<string, unknown>;
            descriptor = {
                ...descriptorRecord,
                mcpId: resolvedProvider,
                toolName: resolvedToolName,
            };
        }

        return {
            ...dependency,
            id: `${resolvedProvider}|${resolvedToolName}`,
            metadata: mergedMetadata,
            descriptor,
        };
    }

    private async executeDependencies(params: {
        contextReferenceId: string;
        connections: MCPServerConfig[];
        dependencies: ContextDependency[];
        pack: ContextPack;
    }): Promise<{
        augmentations?: ContextAugmentationsMap;
        syncErrors?: IPromptReferenceSyncError[];
    }> {
        const { contextReferenceId, connections, dependencies, pack } = params;

        if (!dependencies.length) {
            return {};
        }

        const adapter = createMCPAdapter({
            servers: connections.map((connection) => ({
                ...connection,
                timeout: connection.timeout ?? 10_000,
                retries: connection.retries ?? 1,
            })),
            defaultTimeout: 60_000,
            maxRetries: 1,
            onError: (error, serverName) => {
                this.logger.warn({
                    message: 'MCP adapter error during context execution',
                    context: CodeReviewContextPackService.name,
                    error,
                    metadata: { serverName },
                });
            },
        });

        const registry = new InMemoryMCPRegistry();
        const connectionRouting = new Map<
            string,
            Map<string, MCPServerConfig>
        >();
        const connectionsByProvider = new Map<string, MCPServerConfig[]>();

        const requiredToolsByProvider = new Map<string, Set<string>>();
        for (const dependency of dependencies) {
            const provider = resolveDependencyProvider(dependency)?.trim();
            const toolName = resolveDependencyToolName(dependency)?.trim();
            if (!provider || !toolName) {
                continue;
            }

            if (!requiredToolsByProvider.has(provider)) {
                requiredToolsByProvider.set(provider, new Set());
            }
            requiredToolsByProvider.get(provider)!.add(toolName);
        }

        for (const connection of connections) {
            const providerId = this.resolveConnectionProviderId(connection);

            if (!providerId) {
                continue;
            }

            if (!connectionsByProvider.has(providerId)) {
                connectionsByProvider.set(providerId, []);
            }

            connectionsByProvider.get(providerId)!.push(connection);
        }

        for (const [providerId, providerConnections] of connectionsByProvider) {
            if (!providerConnections.length) {
                continue;
            }

            const requiredTools = requiredToolsByProvider.get(providerId);
            if (!requiredTools || !requiredTools.size) {
                continue;
            }

            const primaryConnection = providerConnections[0];
            if (!primaryConnection) {
                continue;
            }

            const routing = new Map<string, MCPServerConfig>();
            routing.set('*', primaryConnection);

            const toolsArray: string[] = [];

            for (const toolName of requiredTools) {
                const trimmedTool = toolName?.trim();
                if (!trimmedTool) {
                    continue;
                }

                toolsArray.push(trimmedTool);

                if (routing.has(trimmedTool)) {
                    continue;
                }

                const supportingConnection = providerConnections.find(
                    (connection) =>
                        (connection.allowedTools ?? []).includes(trimmedTool),
                );

                routing.set(
                    trimmedTool,
                    supportingConnection ?? primaryConnection,
                );
            }

            if (!toolsArray.length) {
                continue;
            }

            connectionRouting.set(providerId, routing);

            registry.register({
                id: providerId,
                title: primaryConnection.name ?? providerId,
                endpoint: primaryConnection.url ?? '',
                description: primaryConnection.name ?? providerId,
                status: 'available',
                tools: toolsArray.map((toolName) => ({
                    mcpId: providerId,
                    toolName,
                    metadata: {},
                })),
                metadata: {
                    serverName: primaryConnection.name ?? providerId,
                    provider: providerId,
                },
            } satisfies MCPRegistration);
        }

        const client = new AdapterBackedMCPClient(adapter, connectionRouting);

        const orchestrator = new MCPOrchestrator(registry, client, {
            logger: {
                debug: (message, meta) =>
                    this.logger.debug({
                        message,
                        context: CodeReviewContextPackService.name,
                        metadata: meta,
                    }),
                info: (message, meta) =>
                    this.logger.log({
                        message,
                        context: CodeReviewContextPackService.name,
                        metadata: meta,
                    }),
                warn: (message, meta) =>
                    this.logger.warn({
                        message,
                        context: CodeReviewContextPackService.name,
                        metadata: meta,
                    }),
                error: (message, meta) =>
                    this.logger.error({
                        message,
                        context: CodeReviewContextPackService.name,
                        metadata: meta,
                    }),
            },
        });

        const dependencyIndex = this.buildDependencyIndex(dependencies);
        const augmentations: ContextAugmentationsMap = {};
        const executionSyncErrors: IPromptReferenceSyncError[] = [];

        try {
            await adapter.connect();

            const report = await orchestrator.executeRequiredTools({
                pack,
                input: DEFAULT_LAYER_INPUT,
                dependencies,
            });

            for (const record of report.results) {
                const metadata = (record.tool.metadata ?? {}) as Record<
                    string,
                    unknown
                >;

                const provider =
                    (metadata.provider as string | undefined) ??
                    record.tool.mcpId;
                const toolName = record.tool.toolName;
                const pathKey =
                    (metadata.pathKey as string | undefined) ??
                    (Array.isArray(metadata.path)
                        ? pathToKey(metadata.path as string[])
                        : undefined);
                const key = this.buildAugmentationKey(
                    pathKey,
                    provider,
                    toolName,
                );

                if (!key) {
                    continue;
                }

                const dependencyMeta = dependencyIndex.get(key);
                if (!dependencyMeta) {
                    continue;
                }

                if (!augmentations[dependencyMeta.pathKey]) {
                    augmentations[dependencyMeta.pathKey] = {
                        path: dependencyMeta.path,
                        requirementId: dependencyMeta.requirementId,
                        outputs: [],
                    };
                }

                const outputEntry: ContextAugmentationOutput = {
                    provider: dependencyMeta.provider,
                    toolName: dependencyMeta.toolName,
                    success: record.result?.success ?? false,
                };

                if (record.result?.success) {
                    outputEntry.output = this.formatToolOutput(
                        record.result.output,
                    );
                } else {
                    const errorPayload =
                        record.result?.error ??
                        record.result?.output ??
                        record.result ??
                        record.error ??
                        'Unknown MCP error';
                    const errorSummary =
                        this.extractMCPErrorSummary(errorPayload);

                    outputEntry.error = this.formatToolOutput(errorPayload);

                    executionSyncErrors.push({
                        type: PromptReferenceErrorType.MCP_EXECUTION_FAILED,
                        message: `MCP tool ${dependencyMeta.toolName} (${dependencyMeta.provider ?? 'unknown provider'}) failed: ${errorSummary}`,
                        details: {
                            timestamp: new Date(),
                        },
                    });
                }

                augmentations[dependencyMeta.pathKey].outputs.push(outputEntry);
            }
        } catch (error) {
            this.logger.error({
                message:
                    'Failed to execute context dependencies via MCP orchestrator',
                context: CodeReviewContextPackService.name,
                error,
                metadata: {
                    contextReferenceId,
                },
            });
            executionSyncErrors.push({
                type: PromptReferenceErrorType.MCP_EXECUTION_FAILED,
                message: `MCP orchestrator execution failed: ${this.extractMCPErrorSummary(error)}`,
                details: {
                    timestamp: new Date(),
                },
            });
        } finally {
            try {
                await adapter.disconnect();
            } catch (error) {
                this.logger.warn({
                    message:
                        'Failed to disconnect MCP adapter after orchestrator run',
                    context: CodeReviewContextPackService.name,
                    error,
                });
            }
        }

        return {
            augmentations: Object.keys(augmentations).length
                ? augmentations
                : undefined,
            syncErrors: executionSyncErrors.length
                ? executionSyncErrors
                : undefined,
        };
    }

    private async assemblePackFromPipeline(params: {
        contextReferenceId: string;
        instructionsLayer?: ContextLayer;
        externalLayers?: ContextLayer[];
    }): Promise<ContextPack> {
        const steps: PackAssemblyStep[] = [];

        if (params.instructionsLayer) {
            const snapshot = this.cloneLayer(params.instructionsLayer);
            steps.push({
                description: 'Code review instructions',
                builder: new StaticLayerBuilder(() =>
                    this.cloneLayer(snapshot),
                ),
            });
        }

        const pipeline = new SequentialPackAssemblyPipeline({
            steps,
            createdBy: 'code-review-context-pack',
            packIdFactory: () => `code-review:${params.contextReferenceId}`,
            versionFactory: () => '1.0.0',
        });

        const input: LayerInputContext = {
            domain: DEFAULT_LAYER_INPUT.domain,
            taskIntent: DEFAULT_LAYER_INPUT.taskIntent,
            retrieval: {
                candidates: [],
                diagnostics: {},
            },
            metadata: {
                contextReferenceId: params.contextReferenceId,
            },
        };

        const { pack } = await pipeline.execute(input);

        if (params.externalLayers?.length) {
            for (const layer of params.externalLayers) {
                pack.layers.push(this.cloneLayer(layer));
            }
        }

        return pack;
    }

    private createInstructionsLayer(
        contextReferenceId: string,
        overrides?: CodeReviewConfig['v2PromptOverrides'],
    ): ContextLayer | undefined {
        if (!overrides) {
            return undefined;
        }

        return {
            id: `${contextReferenceId}::instructions`,
            kind: 'core',
            priority: 1,
            tokens: 0,
            content: deepClone(overrides),
            references: [],
            metadata: {
                contextReferenceId,
                sourceType: 'instructions',
            },
        };
    }

    private buildDependencyIndex(dependencies: ContextDependency[]): Map<
        string,
        {
            pathKey: string;
            path: string[];
            requirementId?: string;
            provider?: string;
            toolName: string;
        }
    > {
        const index = new Map<
            string,
            {
                pathKey: string;
                path: string[];
                requirementId?: string;
                provider?: string;
                toolName: string;
            }
        >();

        for (const dependency of dependencies) {
            const provider = resolveDependencyProvider(dependency);
            const toolName = resolveDependencyToolName(dependency);
            const path = this.resolveDependencyPath(dependency);
            const pathKey = this.resolveDependencyPathKey(dependency);

            if (!toolName || !pathKey) {
                continue;
            }

            const key = this.buildAugmentationKey(pathKey, provider, toolName);
            if (!key) {
                continue;
            }

            index.set(key, {
                pathKey,
                path,
                requirementId: this.resolveRequirementId(dependency),
                provider,
                toolName,
            });
        }

        return index;
    }

    private createAugmentationsLayer(
        contextReferenceId: string,
        augmentations: ContextAugmentationsMap,
    ): ContextLayer {
        return {
            id: `${contextReferenceId}::augmentations`,
            kind: 'metadata',
            priority: 1,
            tokens: 0,
            content: augmentations,
            references: [],
            metadata: {
                contextReferenceId,
                sourceType: 'augmentations',
            },
        };
    }

    private resolveRequirementPath(requirement: ContextRequirement): string[] {
        if (
            Array.isArray(requirement.metadata?.path) &&
            requirement.metadata.path.every(
                (segment) => typeof segment === 'string',
            )
        ) {
            return requirement.metadata.path as string[];
        }

        return this.derivePathFromRequirementId(requirement.id);
    }

    private resolveDependencyPath(dependency: ContextDependency): string[] {
        if (
            Array.isArray(dependency.metadata?.path) &&
            dependency.metadata.path.every(
                (segment) => typeof segment === 'string',
            )
        ) {
            return dependency.metadata.path as string[];
        }

        const requirementId = this.resolveRequirementId(dependency);
        if (requirementId) {
            return this.derivePathFromRequirementId(requirementId);
        }

        return [];
    }

    private resolveDependencyPathKey(
        dependency: ContextDependency,
    ): string | undefined {
        if (typeof dependency.metadata?.pathKey === 'string') {
            return dependency.metadata.pathKey as string;
        }

        const path = this.resolveDependencyPath(dependency);
        return path.length ? pathToKey(path) : undefined;
    }

    private resolveRequirementId(
        dependency: ContextDependency,
    ): string | undefined {
        if (typeof dependency.metadata?.requirementId === 'string') {
            return dependency.metadata.requirementId as string;
        }
        return undefined;
    }

    private derivePathFromRequirementId(id: string): string[] {
        if (!id.includes('#')) {
            return [id];
        }

        const [, tail] = id.split('#');
        return tail.split('.');
    }

    private parseDependency(dependency: ContextDependency): {
        provider?: string;
        toolName?: string;
        args?: Record<string, unknown>;
    } {
        const metadata = dependency.metadata ?? {};

        const provider = resolveDependencyProvider(dependency);
        const toolName = resolveDependencyToolName(dependency);

        const args =
            metadata.args && isPlainObject(metadata.args)
                ? (metadata.args as Record<string, unknown>)
                : undefined;

        return { provider, toolName, args };
    }

    private buildAugmentationKey(
        pathKey?: string,
        provider?: string,
        toolName?: string,
    ): string | undefined {
        if (!pathKey || !toolName) {
            return undefined;
        }
        const providerKey = provider ?? 'default';
        return `${pathKey}::${providerKey}::${toolName}`;
    }

    private formatToolOutput(result: unknown): string {
        return formatMCPOutput(result, (value) => tryParseJSON(value));
    }

    private extractMCPErrorSummary(error: unknown): string {
        if (!error) {
            return 'Unknown error';
        }
        if (typeof error === 'string') {
            return error;
        }
        if (error instanceof Error) {
            return error.message;
        }
        if (
            typeof error === 'object' &&
            error &&
            typeof (error as Record<string, unknown>).message === 'string'
        ) {
            return (error as Record<string, unknown>).message as string;
        }
        try {
            return JSON.stringify(error);
        } catch {
            return String(error);
        }
    }

    private cloneLayer(layer: ContextLayer): ContextLayer {
        return {
            ...layer,
            content: deepClone(layer.content),
            references: layer.references.map((ref) => ({ ...ref })),
            metadata: layer.metadata ? deepClone(layer.metadata) : undefined,
        };
    }
}
