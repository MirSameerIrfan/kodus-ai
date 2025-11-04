import { Injectable } from '@nestjs/common';
import { createMCPAdapter, type MCPServerConfig } from '@kodus/flow';
import type { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
import type { CodeReviewConfig } from '@/config/types/general/codeReview.type';
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
import { ContextReferenceService } from './context-reference.service';
import { MCPToolArgResolver } from './mcp-tool-arg-resolver.service';
import {
    CODE_REVIEW_CONTEXT_PATTERNS,
    pathToKey,
    stripMarkersFromText,
} from './code-review-context.utils';
import {
    MCPToolMetadata,
    MCPToolMetadataService,
} from '../../mcp/services/mcp-tool-metadata.service';
import { PinoLoggerService } from '../logger/pino.service';

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
}

interface BuildPackResult {
    sanitizedOverrides?: CodeReviewConfig['v2PromptOverrides'];
    augmentations?: ContextAugmentationsMap;
    pack?: ContextPack;
}

const MAX_TOOL_OUTPUT_LENGTH = 1200;
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

/**
 * Une os argumentos declarados na dependência MCP com o contexto padrão
 * passado pelo orchestrator, priorizando os valores explícitos do requisito.
 */
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
        private readonly connectionById: Map<string, MCPServerConfig>,
    ) {}

    async invoke(request: MCPInvocationRequest): Promise<MCPInvocationResult> {
        const startedAt = Date.now();

        try {
            const serverConfig = this.connectionById.get(request.registry.id);
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
}

@Injectable()
export class CodeReviewContextPackService {
    constructor(
        private readonly contextReferenceService: ContextReferenceService,
        private readonly mcpToolMetadataService: MCPToolMetadataService,
        private readonly logger: PinoLoggerService,
        private readonly mcpToolArgResolver: MCPToolArgResolver,
    ) {}

    /**
     * Monta o `ContextPack` com as instruções do usuário, camadas externas e
     * execuções MCP necessárias para o review.
     */
    async buildContextPack(params: BuildPackParams): Promise<BuildPackResult> {
        const { organizationAndTeamData, contextReferenceId, overrides } =
            params;

        const sanitizedOverrides = this.sanitizeOverrides(overrides);

        if (!contextReferenceId || !organizationAndTeamData?.organizationId) {
            return { sanitizedOverrides };
        }

        const reference =
            await this.contextReferenceService.findById(contextReferenceId);

        if (!reference) {
            return { sanitizedOverrides };
        }

        const requirements = reference.requirements ?? [];
        const dependencies = this.buildDependencies(requirements);
        const hasPackContent =
            Boolean(sanitizedOverrides) ||
            dependencies.length > 0 ||
            (params.externalLayers?.length ?? 0) > 0;

        if (!hasPackContent) {
            return { sanitizedOverrides };
        }

        const instructionsLayer = this.createInstructionsLayer(
            contextReferenceId,
            sanitizedOverrides,
        );

        const pack = await this.assemblePackFromPipeline({
            contextReferenceId,
            instructionsLayer,
            externalLayers: params.externalLayers,
        });

        pack.dependencies = dependencies;
        pack.metadata = {
            ...(pack.metadata ?? {}),
            contextReferenceId,
            requirementIds: requirements.map((req) => req.id),
        };

        const metadataLoad = dependencies.length
            ? await this.mcpToolMetadataService.loadMetadataForOrganization(
                  organizationAndTeamData,
              )
            : {
                  connections: [] as MCPServerConfig[],
                  metadata: new Map<string, MCPToolMetadata>(),
                  providerMap: new Map<string, string>(),
                  toolMap: new Map<string, Map<string, string>>(),
                  allowedTools: new Map<string, Set<string>>(),
              };

        let connections = metadataLoad.connections;
        let metadata = metadataLoad.metadata;
        let providerAliases = metadataLoad.providerMap;
        let toolAliases = metadataLoad.toolMap;

        if (dependencies.length && metadata.size) {
            const neededProviders = this.collectNeededProviders(
                dependencies,
                providerAliases,
            );

            if (neededProviders.size) {
                connections = this.filterConnectionsByProviders(
                    connections,
                    neededProviders,
                );
                metadata = this.filterMetadataByProviders(
                    metadata,
                    neededProviders,
                );
                providerAliases = this.filterProviderAliases(
                    providerAliases,
                    neededProviders,
                );
                toolAliases = this.filterToolAliases(
                    toolAliases,
                    providerAliases,
                    neededProviders,
                );

                if (!metadata.size) {
                    connections = [];
                    providerAliases = new Map<string, string>();
                    toolAliases = new Map<string, Map<string, string>>();
                }
            } else {
                connections = [];
                metadata = new Map<string, MCPToolMetadata>();
                providerAliases = new Map<string, string>();
                toolAliases = new Map<string, Map<string, string>>();
            }
        }

        const { resolvedDependencies, skippedDependencies } =
            await this.resolveMCPDependenciesForPack({
                dependencies,
                pack,
                organizationAndTeamData,
                toolMetadata: metadata,
                providerAliases,
                toolAliases,
            });

        pack.dependencies = resolvedDependencies;

        if (!resolvedDependencies.length) {
            return {
                sanitizedOverrides,
                pack,
            };
        }

        if (!connections?.length) {
            return {
                sanitizedOverrides,
                pack,
            };
        }

        const { augmentations } = await this.executeDependencies({
            contextReferenceId,
            connections,
            dependencies: resolvedDependencies,
            pack,
        });

        if (augmentations && Object.keys(augmentations).length > 0) {
            pack.layers.push(
                this.createAugmentationsLayer(
                    contextReferenceId,
                    augmentations,
                ),
            );
        }

        return {
            sanitizedOverrides,
            augmentations,
            pack,
        };
    }

    /**
     * Remove marcadores e campos vazios dos overrides antes de inseri-los no pack.
     */
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
                const result: Record<string, unknown> = {};
                for (const [key, value] of Object.entries(node)) {
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

    /**
     * Converte os requirements em uma lista deduplicada de dependências MCP.
     */
    private buildDependencies(
        requirements: ContextRequirement[],
    ): ContextDependency[] {
        const dependencies: ContextDependency[] = [];
        const dedupe = new Set<string>();

        for (const requirement of requirements) {
            const path = this.resolveRequirementPath(requirement);
            const pathKey = pathToKey(path);

            for (const dependency of requirement.dependencies ?? []) {
                if (!dependency || dependency.type !== 'mcp') {
                    continue;
                }

                const { provider, toolName, args } =
                    this.parseDependency(dependency);
                if (!provider || !toolName) {
                    continue;
                }

                const uniqueKey = `${pathKey}::${provider}::${toolName}`;
                if (dedupe.has(uniqueKey)) {
                    continue;
                }
                dedupe.add(uniqueKey);

                const metadata = {
                    ...(dependency.metadata ?? {}),
                    provider,
                    toolName,
                    path,
                    pathKey,
                    requirementId: requirement.id,
                    ...(args ? { args } : {}),
                };

                const descriptor = this.buildDescriptor(
                    dependency.descriptor,
                    provider,
                    toolName,
                    metadata,
                );

                dependencies.push({
                    type: 'mcp',
                    id: `${provider}|${toolName}`,
                    descriptor,
                    metadata,
                });
            }
        }

        return dependencies;
    }

    /**
     * Garante que o descriptor de uma dependência MCP tenha provider/tool/metadata completos.
     */
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
        providerAliases: Map<string, string>;
        toolAliases: Map<string, Map<string, string>>;
    }): Promise<{
        resolvedDependencies: ContextDependency[];
        skippedDependencies: SkippedMCPTool[];
    }> {
        const {
            dependencies,
            pack,
            organizationAndTeamData,
            toolMetadata,
            providerAliases,
            toolAliases,
        } = params;
        const resolvedDependencies: ContextDependency[] = [];
        const skippedDependencies: SkippedMCPTool[] = [];

        for (const dependency of dependencies) {
            try {
                const enrichedDependency = this.applyToolMetadata(
                    dependency,
                    toolMetadata,
                    providerAliases,
                    toolAliases,
                );

                const resolution = await this.mcpToolArgResolver.resolve({
                    dependency: enrichedDependency,
                    organizationAndTeamData,
                    pack,
                    input: DEFAULT_LAYER_INPUT,
                    runtime: undefined,
                });

                if (resolution.status === 'ready') {
                    resolvedDependencies.push(resolution.dependency);
                    continue;
                }

                const provider = this.resolveProvider(enrichedDependency);
                const toolName = this.resolveToolName(enrichedDependency);
                const requirementId =
                    this.resolveRequirementId(enrichedDependency);
                const path = this.resolveDependencyPath(enrichedDependency);

                const message = `MCP tool ${provider ?? 'unknown'}::${
                    toolName ?? 'unknown'
                } não executada. Argumentos ausentes: ${
                    resolution.missingArgs.join(', ') || 'desconhecidos'
                }.`;

                this.logger.warn({
                    message,
                    context: CodeReviewContextPackService.name,
                    metadata: {
                        provider,
                        toolName,
                        requirementId,
                        missingArgs: resolution.missingArgs,
                        path,
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
                const provider = this.resolveProvider(dependency);
                const toolName = this.resolveToolName(dependency);

                this.logger.error({
                    message:
                        'Erro ao resolver argumentos para ferramenta MCP antes da execução',
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
                        'Falha interna ao preparar argumentos para a ferramenta MCP.',
                });
            }
        }

        return { resolvedDependencies, skippedDependencies };
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
        providerAliases: Map<string, string>,
        toolAliases: Map<string, Map<string, string>>,
    ): ContextDependency {
        const provider = this.resolveProvider(dependency);
        const toolName = this.resolveToolName(dependency);

        if (!provider || !toolName) {
            return dependency;
        }

        const metadata = this.mcpToolMetadataService.getMetadataForTool(
            metadataMap,
            provider,
            toolName,
            providerAliases,
            toolAliases,
        );
        if (!metadata) {
            return dependency;
        }

        const normalizedProviderKey = this.normalizeProviderKey(provider);
        const canonicalProvider = normalizedProviderKey
            ? (providerAliases.get(normalizedProviderKey) ?? provider)
            : provider;

        const providerToolKey = this.normalizeProviderKey(canonicalProvider);
        let canonicalToolName = toolName;
        if (providerToolKey) {
            const providerToolMap = toolAliases.get(providerToolKey);
            if (providerToolMap) {
                const toolAliasKey = this.normalizeToolKey(toolName);
                if (toolAliasKey) {
                    const resolved = providerToolMap.get(toolAliasKey);
                    if (resolved) {
                        canonicalToolName = resolved;
                    }
                }
            }
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
            provider: canonicalProvider,
            toolName: canonicalToolName,
        } as Record<string, unknown>;

        if (
            provider &&
            canonicalProvider &&
            provider !== canonicalProvider &&
            !mergedMetadata.providerAlias
        ) {
            mergedMetadata.providerAlias = provider;
        }

        if (
            toolName &&
            canonicalToolName &&
            toolName !== canonicalToolName &&
            !mergedMetadata.toolNameAlias
        ) {
            mergedMetadata.toolNameAlias = toolName;
        }

        let descriptor = dependency.descriptor;
        if (descriptor && typeof descriptor === 'object') {
            const descriptorRecord = descriptor as Record<string, unknown>;
            descriptor = {
                ...descriptorRecord,
                mcpId: canonicalProvider,
                toolName: canonicalToolName,
            };
        }

        return {
            ...dependency,
            metadata: mergedMetadata,
            descriptor,
        };
    }

    private normalizeProviderKey(value?: string | null): string | undefined {
        if (!value) {
            return undefined;
        }

        const normalized = value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');

        if (!normalized) {
            return undefined;
        }

        return normalized.endsWith('mcp') && normalized.length > 3
            ? normalized.slice(0, -3)
            : normalized;
    }

    private normalizeToolKey(value?: string | null): string | undefined {
        if (!value) {
            return undefined;
        }

        const normalized = value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');

        return normalized || undefined;
    }

    private collectNeededProviders(
        dependencies: ContextDependency[],
        providerAliases: Map<string, string>,
    ): Set<string> {
        const needed = new Set<string>();

        for (const dependency of dependencies) {
            const provider = this.resolveProvider(dependency);
            if (!provider) {
                continue;
            }

            const aliasKey = this.normalizeProviderKey(provider);
            const canonical = aliasKey
                ? (providerAliases.get(aliasKey) ?? provider)
                : provider;

            needed.add(canonical);
        }

        return needed;
    }

    private filterConnectionsByProviders(
        connections: MCPServerConfig[],
        neededProviders: Set<string>,
    ): MCPServerConfig[] {
        return connections.filter((connection) => {
            const canonical =
                connection.provider?.trim() ||
                connection.name?.trim() ||
                connection.url?.trim();

            if (!canonical) {
                return false;
            }

            if (neededProviders.has(canonical)) {
                return true;
            }

            const normalized = this.normalizeProviderKey(canonical);
            return normalized ? neededProviders.has(normalized) : false;
        });
    }

    private filterMetadataByProviders(
        metadata: Map<string, MCPToolMetadata>,
        neededProviders: Set<string>,
    ): Map<string, MCPToolMetadata> {
        const filtered = new Map<string, MCPToolMetadata>();

        for (const [key, value] of metadata.entries()) {
            const [providerKey] = key.split('|', 1);
            const canonical = providerKey ?? key;
            if (neededProviders.has(canonical)) {
                filtered.set(key, value);
            }
        }

        return filtered;
    }

    private filterProviderAliases(
        providerAliases: Map<string, string>,
        neededProviders: Set<string>,
    ): Map<string, string> {
        const filtered = new Map<string, string>();

        for (const [alias, canonical] of providerAliases.entries()) {
            if (neededProviders.has(canonical)) {
                filtered.set(alias, canonical);
            }
        }

        return filtered;
    }

    private filterToolAliases(
        toolAliases: Map<string, Map<string, string>>,
        providerAliases: Map<string, string>,
        neededProviders: Set<string>,
    ): Map<string, Map<string, string>> {
        const filtered = new Map<string, Map<string, string>>();

        for (const [aliasKey, toolMap] of toolAliases.entries()) {
            const canonical = providerAliases.get(aliasKey) ?? aliasKey;

            if (!neededProviders.has(canonical)) {
                continue;
            }

            filtered.set(aliasKey, toolMap);
        }

        return filtered;
    }

    /**
     * Executa todas as ferramentas MCP necessárias e devolve as augmentations resultantes.
     */
    private async executeDependencies(params: {
        contextReferenceId: string;
        connections: MCPServerConfig[];
        dependencies: ContextDependency[];
        pack: ContextPack;
    }): Promise<{ augmentations?: ContextAugmentationsMap }> {
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
            defaultTimeout: 10_000,
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

        const connectionById = new Map<string, MCPServerConfig>();
        const registry = new InMemoryMCPRegistry();

        const requiredToolsByProvider = new Map<string, Set<string>>();
        for (const dependency of dependencies) {
            const provider = this.resolveProvider(dependency);
            const toolName = this.resolveToolName(dependency);
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

            connectionById.set(providerId, connection);

            const requiredTools =
                requiredToolsByProvider.get(providerId) ?? new Set<string>();
            const toolsToRegister =
                requiredTools.size > 0
                    ? Array.from(requiredTools)
                    : Array.from(connection.allowedTools ?? []);

            registry.register({
                id: providerId,
                title: connection.name ?? providerId,
                endpoint: connection.url ?? '',
                description: connection.name ?? providerId,
                status: 'available',
                tools: toolsToRegister.map((toolName) => ({
                    mcpId: providerId,
                    toolName,
                    metadata: {},
                })),
                metadata: {
                    serverName: connection.name ?? providerId,
                    provider: connection.provider ?? providerId,
                },
            } satisfies MCPRegistration);
        }

        const client = new AdapterBackedMCPClient(adapter, connectionById);

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

        try {
            await adapter.connect();

            const report = await orchestrator.executeRequiredTools({
                pack,
                input: DEFAULT_LAYER_INPUT,
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
                } else if (record.result?.error?.message) {
                    outputEntry.error = record.result.error.message;
                } else if (record.error) {
                    outputEntry.error = record.error;
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
        };
    }

    /**
     * Constrói o `ContextPack` usando o pipeline sequencial (instruções + layers externos).
     */
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

    /**
     * Cria a camada de instruções com os overrides sanitizados do usuário.
     */
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
            content: this.deepClone(overrides),
            references: [],
            metadata: {
                contextReferenceId,
            },
        };
    }

    /**
     * Indexa dependências MCP para associar resultados do orchestrator às seções corretas.
     */
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
            const provider = this.resolveProvider(dependency);
            const toolName = this.resolveToolName(dependency);
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

    /**
     * Constrói uma camada contendo as respostas das ferramentas MCP.
     */
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
            },
        };
    }

    /**
     * Extrai o path de um requirement (usado para mapear augmentations).
     */
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

    /**
     * Resolve o path associado a uma dependência (fallback para requirementId).
     */
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

    /**
     * Cria a chave normalizada (`pathKey`) de uma dependência.
     */
    private resolveDependencyPathKey(
        dependency: ContextDependency,
    ): string | undefined {
        if (typeof dependency.metadata?.pathKey === 'string') {
            return dependency.metadata.pathKey as string;
        }

        const path = this.resolveDependencyPath(dependency);
        return path.length ? pathToKey(path) : undefined;
    }

    /**
     * Recupera o requirementId original associado à dependência (se existir).
     */
    private resolveRequirementId(
        dependency: ContextDependency,
    ): string | undefined {
        if (typeof dependency.metadata?.requirementId === 'string') {
            return dependency.metadata.requirementId as string;
        }
        return undefined;
    }

    /**
     * Converte um requirementId (`foo#bar.baz`) no path correspondente.
     */
    private derivePathFromRequirementId(id: string): string[] {
        if (!id.includes('#')) {
            return [id];
        }

        const [, tail] = id.split('#');
        return tail.split('.');
    }

    /**
     * Normaliza os campos (provider, toolName, args) de uma dependência MCP.
     */
    private parseDependency(dependency: ContextDependency): {
        provider?: string;
        toolName?: string;
        args?: Record<string, unknown>;
    } {
        const metadata = dependency.metadata ?? {};

        const provider =
            (typeof metadata.provider === 'string'
                ? (metadata.provider as string)
                : undefined) ??
            (typeof metadata.mcpId === 'string'
                ? (metadata.mcpId as string)
                : undefined) ??
            dependency.id.split('|')[0];

        const toolName =
            (typeof metadata.toolName === 'string'
                ? (metadata.toolName as string)
                : undefined) ??
            (typeof metadata.tool === 'string'
                ? (metadata.tool as string)
                : undefined) ??
            dependency.id.split('|')[1];

        const args =
            metadata.args && isPlainObject(metadata.args)
                ? (metadata.args as Record<string, unknown>)
                : undefined;

        return { provider, toolName, args };
    }

    /**
     * Determina o provider (MCP id) de uma dependência.
     */
    private resolveProvider(dependency: ContextDependency): string | undefined {
        const metadata = dependency.metadata ?? {};
        if (typeof metadata.provider === 'string') {
            return metadata.provider as string;
        }
        if (typeof metadata.mcpId === 'string') {
            return metadata.mcpId as string;
        }
        const [provider] = dependency.id.split('|', 2);
        return provider || undefined;
    }

    /**
     * Determina o nome da tool de uma dependência.
     */
    private resolveToolName(dependency: ContextDependency): string | undefined {
        const metadata = dependency.metadata ?? {};
        if (typeof metadata.toolName === 'string') {
            return metadata.toolName as string;
        }
        if (typeof metadata.tool === 'string') {
            return metadata.tool as string;
        }
        const [, toolName] = dependency.id.split('|', 2);
        return toolName || undefined;
    }

    /**
     * Combina pathKey + provider/tool em uma chave única para augmentations.
     */
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

    /**
     * Serializa o resultado bruto de uma tool MCP para texto legível.
     */
    private formatToolOutput(result: unknown): string {
        if (result === null || result === undefined) {
            return 'No output returned.';
        }

        if (typeof result === 'string') {
            return this.truncate(result);
        }

        try {
            return this.truncate(JSON.stringify(result, null, 2));
        } catch {
            return this.truncate(String(result));
        }
    }

    /**
     * Função utilitária para limitar o tamanho da string de output.
     */
    private truncate(value: string, max = MAX_TOOL_OUTPUT_LENGTH): string {
        if (value.length <= max) {
            return value;
        }
        return `${value.slice(0, max)}…`;
    }

    /**
     * Produz uma cópia defensiva de uma camada do pack.
     */
    private cloneLayer(layer: ContextLayer): ContextLayer {
        return {
            ...layer,
            content: this.deepClone(layer.content),
            references: layer.references.map((ref) => ({ ...ref })),
            metadata: layer.metadata
                ? this.deepClone(layer.metadata)
                : undefined,
        };
    }

    private deepClone<T>(value: T): T {
        if (value === null || value === undefined) {
            return value;
        }

        try {
            return JSON.parse(JSON.stringify(value)) as T;
        } catch {
            return value;
        }
    }
}
