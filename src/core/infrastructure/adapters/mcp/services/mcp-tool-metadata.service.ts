import { Injectable } from '@nestjs/common';
import { createMCPAdapter, type MCPServerConfig } from '@kodus/flow';
import type { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
import { MCPManagerService } from './mcp-manager.service';
import { PinoLoggerService } from '../../services/logger/pino.service';

export interface MCPToolMetadata {
    requiredArgs: string[];
    inputSchema?: unknown;
}

interface MetadataLoadResult {
    connections: MCPServerConfig[];
    metadata: Map<string, MCPToolMetadata>;
    providerMap: Map<string, string>;
    toolMap: Map<string, Map<string, string>>;
    allowedTools: Map<string, Set<string>>;
}

@Injectable()
export class MCPToolMetadataService {
    constructor(
        private readonly mcpManagerService: MCPManagerService,
        private readonly logger: PinoLoggerService,
    ) {}

    async loadMetadataForOrganization(
        organizationAndTeamData?: OrganizationAndTeamData,
    ): Promise<MetadataLoadResult> {
        if (!organizationAndTeamData?.organizationId) {
            return this.buildEmptyResult();
        }

        const rawConnections = (await this.mcpManagerService.getConnections(
            organizationAndTeamData,
            true,
        )) as MCPServerConfig[];

        if (!rawConnections?.length) {
            return this.buildEmptyResult();
        }

        const { metadata, providersWithMetadata } =
            await this.buildMetadataFromConnections(rawConnections);

        if (!metadata.size) {
            return this.buildEmptyResult();
        }

        const filteredConnections = rawConnections.filter((connection) => {
            const canonical =
                connection.provider?.trim() ||
                connection.name?.trim() ||
                connection.url?.trim();
            if (!canonical) {
                return false;
            }
            if (providersWithMetadata.has(canonical)) {
                return true;
            }
            const normalized = this.normalizeProviderKey(canonical);
            return normalized ? providersWithMetadata.has(normalized) : false;
        });

        if (!filteredConnections.length) {
            return this.buildEmptyResult();
        }

        let aliasMaps: {
            providerMap: Map<string, string>;
            toolMap: Map<string, Map<string, string>>;
            allowedTools: Map<string, Set<string>>;
        };

        try {
            aliasMaps = this.buildAliasMaps(filteredConnections);
        } catch (error) {
            this.logger.warn({
                message: 'Falha ao construir alias maps para MCP',
                context: MCPToolMetadataService.name,
                error,
            });
            aliasMaps = {
                providerMap: new Map(),
                toolMap: new Map(),
                allowedTools: new Map(),
            };
        }

        return {
            connections: filteredConnections,
            metadata,
            ...aliasMaps,
        };
    }

    getMetadataForTool(
        map: Map<string, MCPToolMetadata>,
        providerId: string | undefined,
        toolName: string | undefined,
        providerMap: Map<string, string>,
        toolMap: Map<string, Map<string, string>>,
    ): MCPToolMetadata | undefined {
        if (!providerId || !toolName) {
            return undefined;
        }

        const canonicalProvider =
            this.resolveCanonicalProvider(providerId, providerMap) ?? providerId;
        const canonicalTool =
            this.resolveCanonicalTool(toolName, canonicalProvider, toolMap) ??
            toolName;

        return map.get(`${canonicalProvider}|${canonicalTool}`);
    }

    private buildEmptyResult(): MetadataLoadResult {
        return {
            connections: [],
            metadata: new Map(),
            providerMap: new Map(),
            toolMap: new Map(),
            allowedTools: new Map(),
        };
    }

    private async buildMetadataFromConnections(
        connections: MCPServerConfig[],
    ): Promise<{
        metadata: Map<string, MCPToolMetadata>;
        providersWithMetadata: Set<string>;
    }> {
        const metadataMap = new Map<string, MCPToolMetadata>();
        const providersWithMetadata = new Set<string>();

        if (!connections.length) {
            return { metadata: metadataMap, providersWithMetadata };
        }

        const adapter = createMCPAdapter({
            servers: connections,
            defaultTimeout: 10_000,
            maxRetries: 1,
            onError: (error, serverName) => {
                this.logger.warn({
                    message: 'Erro ao sincronizar metadata das ferramentas MCP',
                    context: MCPToolMetadataService.name,
                    error,
                    metadata: { serverName },
                });
            },
        });

        try {
            await adapter.connect();
            const registry = adapter.getRegistry() as {
                listAllTools?: () => Promise<
                    Array<{
                        name: string;
                        serverName?: string;
                        inputSchema?: unknown;
                    }>
                >;
            };
            const tools =
                (await registry.listAllTools?.()) ??
                ([] as Array<{
                    name: string;
                    serverName?: string;
                    inputSchema?: unknown;
                }>);

            const providerIndex = new Map<string, string>();
            for (const connection of connections) {
                const providerId = this.resolveConnectionProviderId(connection);
                if (!providerId) continue;
                const key = connection.name ?? providerId;
                providerIndex.set(key, providerId);
            }

            for (const tool of tools) {
                const serverName = tool.serverName ?? '';
                const providerId = providerIndex.get(serverName);
                if (!providerId) continue;

                const requiredArgs = this.extractRequiredArgs(tool.inputSchema);
                const metadata: MCPToolMetadata = {
                    requiredArgs,
                    inputSchema: tool.inputSchema,
                };

                this.registerMetadataEntry(
                    metadataMap,
                    providersWithMetadata,
                    providerId,
                    tool.name,
                    metadata,
                );
            }
        } catch (error) {
            this.logger.warn({
                message: 'Falha ao coletar metadata das ferramentas MCP',
                context: MCPToolMetadataService.name,
                error,
            });
        } finally {
            try {
                await adapter.disconnect();
            } catch {
                /* ignore */
            }
        }

        return { metadata: metadataMap, providersWithMetadata };
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

    private extractRequiredArgs(schema: unknown): string[] {
        if (!schema || typeof schema !== 'object') {
            return [];
        }

        const candidate = schema as Record<string, unknown>;
        const requiredRaw = candidate.required;
        const required: string[] = Array.isArray(requiredRaw)
            ? requiredRaw
                  .filter((item): item is string => typeof item === 'string')
                  .map((item) => item.trim())
                  .filter((item) => item.length > 0)
            : [];

        if (required.length) {
            return required;
        }

        const properties = candidate.properties as
            | Record<string, unknown>
            | undefined;

        if (!properties) {
            return [];
        }

        const inferred: string[] = [];
        for (const [key, value] of Object.entries(properties)) {
            if (value && typeof value === 'object') {
                const requiredFlag = (value as Record<string, unknown>)
                    .required;
                if (requiredFlag === true) {
                    inferred.push(key);
                }
            }
        }
        return inferred;
    }

    private resolveCanonicalProvider(
        provider: string,
        providerMap: Map<string, string>,
    ): string | undefined {
        const key = this.normalizeProviderKey(provider);
        if (!key) {
            return undefined;
        }
        return providerMap.get(key);
    }

    private resolveCanonicalTool(
        toolName: string,
        canonicalProvider: string,
        toolMap: Map<string, Map<string, string>>,
    ): string | undefined {
        const providerKey = this.normalizeProviderKey(canonicalProvider);
        if (!providerKey) {
            return undefined;
        }

        const providerTools = toolMap.get(providerKey);
        if (!providerTools) {
            return undefined;
        }

        const toolKey = this.normalizeToolKey(toolName);
        if (!toolKey) {
            return undefined;
        }

        return providerTools.get(toolKey);
    }

    private registerMetadataEntry(
        map: Map<string, MCPToolMetadata>,
        providersWithMetadata: Set<string>,
        providerId: string,
        toolName: string,
        metadata: MCPToolMetadata,
    ): void {
        const canonicalProvider = providerId?.trim();
        const canonicalTool = toolName?.trim();

        if (!canonicalProvider || !canonicalTool) {
            return;
        }

        map.set(`${canonicalProvider}|${canonicalTool}`, metadata);

        providersWithMetadata.add(canonicalProvider);

        const normalizedProvider = this.normalizeProviderKey(canonicalProvider);
        if (normalizedProvider) {
            providersWithMetadata.add(normalizedProvider);
        }
    }

    private buildAliasMaps(
        connections: MCPServerConfig[],
    ): {
        providerMap: Map<string, string>;
        toolMap: Map<string, Map<string, string>>;
        allowedTools: Map<string, Set<string>>;
    } {
        const providerMap = new Map<string, string>();
        const toolMap = new Map<string, Map<string, string>>();
        const allowedTools = new Map<string, Set<string>>();

        for (const connection of connections) {
            const canonicalProvider =
                connection.provider?.trim() ||
                connection.name?.trim() ||
                connection.url?.trim();

            if (!canonicalProvider) {
                continue;
            }

            const canonicalValue =
                connection.provider?.trim() ?? canonicalProvider;

            const aliases = new Set<string>();
            const aliasCandidates = [
                canonicalProvider,
                connection.provider,
                connection.name,
                connection.url,
            ];

            for (const candidate of aliasCandidates) {
                const key = this.normalizeProviderKey(candidate);
                if (!key) {
                    continue;
                }
                aliases.add(key);
                if (!providerMap.has(key)) {
                    providerMap.set(key, canonicalValue);
                }

                const stripped = this.stripMcpSuffix(key);
                if (stripped && !aliases.has(stripped)) {
                    aliases.add(stripped);
                    if (!providerMap.has(stripped)) {
                        providerMap.set(stripped, canonicalValue);
                    }
                }
            }

            if (!allowedTools.has(canonicalValue)) {
                allowedTools.set(canonicalValue, new Set());
            }

            const connectionTools = connection.allowedTools ?? [];
            if (!connectionTools.length) {
                continue;
            }

            const normalizedToolEntries = connectionTools
                .map((tool) => tool?.trim())
                .filter((tool): tool is string => Boolean(tool))
                .map((tool) => ({
                    key: this.normalizeToolKey(tool),
                    value: tool,
                }))
                .filter((entry) => Boolean(entry.key)) as Array<{
                key: string;
                value: string;
            }>;

            if (!normalizedToolEntries.length) {
                continue;
            }

            for (const aliasKey of aliases) {
                if (!toolMap.has(aliasKey)) {
                    toolMap.set(aliasKey, new Map());
                }
                const toolAliasMap = toolMap.get(aliasKey)!;
                for (const entry of normalizedToolEntries) {
                    if (!toolAliasMap.has(entry.key)) {
                        toolAliasMap.set(entry.key, entry.value);
                    }
                }
            }

            const providerAllowedSet = allowedTools.get(canonicalValue)!;
            for (const entry of normalizedToolEntries) {
                providerAllowedSet.add(entry.value);
            }
        }

        return { providerMap, toolMap, allowedTools };
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

    private stripMcpSuffix(value?: string | null): string | undefined {
        if (!value) {
            return undefined;
        }

        if (value.length <= 3) {
            return value;
        }

        return value.endsWith('mcp') ? value.slice(0, -3) : value;
    }
}

