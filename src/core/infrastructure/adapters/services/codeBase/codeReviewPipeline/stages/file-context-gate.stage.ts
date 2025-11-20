import { Injectable } from '@nestjs/common';
import { BasePipelineStage } from '../../../pipeline/base-stage.abstract';
import {
    CodeReviewPipelineContext,
    FileContextAgentResult,
} from '../context/code-review-pipeline.context';
import { PinoLoggerService } from '../../../logger/pino.service';
import {
    CodeReviewConfig,
    FileChange,
} from '@/config/types/general/codeReview.type';
import pLimit from 'p-limit';
import type {
    ContextDependency,
    ContextEvidence,
} from '@context-os-core/interfaces';
import { ContextScriptAgentProvider } from '@/core/infrastructure/adapters/services/agent/kodus-flow/contextScriptAgent.provider';
import type { ContextMCPDependency } from '@/core/infrastructure/adapters/services/agent/kodus-flow/contextScriptAgent.provider';
import type { ContextAugmentationsMap } from '@/core/infrastructure/adapters/services/context/code-review-context-pack.service';
import {
    CODE_REVIEW_CONTEXT_PATTERNS,
    pathToKey,
    getOverridesFromPack,
} from '@/core/infrastructure/adapters/services/context/code-review-context.utils';

@Injectable()
export class FileContextGateStage extends BasePipelineStage<CodeReviewPipelineContext> {
    readonly stageName = 'FileContextGateStage';
    private readonly concurrency = 5;

    /**
     * TODO Context-OS/MCP follow-ups:
     * 1. Adicionar cache das execuções MCP por arquivo para evitar chamadas repetidas.
     * 2. Telemetria: logar scripts que não publicarem evidências para dependências obrigatórias.
     * 3. Suporte a reentrância (persistir resultados para execuções reentrantes).
     */
    constructor(
        private readonly logger: PinoLoggerService,
        private readonly contextScriptAgentProvider: ContextScriptAgentProvider,
    ) {
        super();
    }

    protected async executeStage(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        if (!context.changedFiles?.length) {
            return context;
        }

        if (!context.organizationAndTeamData) {
            this.logger.warn({
                message:
                    'Missing organizationAndTeamData, skipping FileContextGateStage',
                context: this.stageName,
            });
            return context;
        }

        const limit = pLimit(this.concurrency);

        const { dependencies: mcpDependencies, lookup: dependencyLookup } =
            this.extractMCPDependencies(
                context.sharedContextPack?.dependencies,
            );

        const targetFiles = context.changedFiles.filter(
            (f) => f.filename === 'src/commands/technicalInfoCommand.ts',
        );

        const results = await Promise.all(
            targetFiles.map((file) =>
                limit(() =>
                    this.analyzeFile(
                        file,
                        context,
                        mcpDependencies,
                        dependencyLookup,
                    ),
                ),
            ),
        );

        // Filter out null/undefined results before building augmentations
        const validResults: FileContextAgentResult[] = [];
        for (const r of results) {
            if (r) {
                validResults.push(r);
            }
        }

        const fileContextMap = results.reduce<Record<string, any>>(
            (acc, entry, idx) => {
                const file = targetFiles[idx];
                if (file?.filename && entry) {
                    acc[file.filename] = entry;
                }
                return acc;
            },
            {},
        );

        return this.updateContext(context, (draft) => {
            draft.fileContextMap = fileContextMap;
            draft.generatedAugmentations = this.mergeAugmentations(
                draft.generatedAugmentations ?? {},
                this.buildAugmentations(validResults),
            );
        });
    }

    private async analyzeFile(
        file: FileChange,
        context: CodeReviewPipelineContext,
        dependencies: ContextMCPDependency[],
        dependencyLookup: Map<string, ContextMCPDependency>,
    ) {
        try {
            const baseOverrides = this.getBasePromptOverrides(context);

            let sandboxEvidences: ContextEvidence[] = [];
            const agentResult =
                await this.contextScriptAgentProvider.executeForFile({
                    organizationAndTeamData: context.organizationAndTeamData,
                    file,
                    dependencies,
                    promptOverrides: baseOverrides,
                    repoContext: this.buildRepositoryContext(context),
                });

            if (!agentResult) {
                this.logger.debug({
                    message: 'Context agent returned null',
                    context: this.stageName,
                    metadata: {
                        file: file.filename,
                        dependenciesCount: dependencies.length,
                    },
                });
                return null;
            }

            if (agentResult?.actionsLog) {
                this.logger.debug({
                    message: 'Context agent actions log',
                    context: this.stageName,
                    metadata: {
                        file: file.filename,
                        actionsLog: agentResult.actionsLog,
                    },
                });
            }

            if (agentResult?.evidences?.length) {
                sandboxEvidences = agentResult.evidences;
            }

            if (!sandboxEvidences.length) {
                this.logger.debug({
                    message: 'No evidences generated by agent',
                    context: this.stageName,
                    metadata: {
                        file: file.filename,
                        actionsLog: agentResult.actionsLog,
                    },
                });
                return null;
            }

            sandboxEvidences = this.attachPathKeyToEvidence(
                sandboxEvidences,
                dependencyLookup,
            );

            const resolvedOverrides = this.resolvePromptOverridesForFile(
                baseOverrides,
                sandboxEvidences,
                dependencyLookup,
            );

            return {
                sandboxEvidences,
                resolvedPromptOverrides: resolvedOverrides,
            };
        } catch (error) {
            this.logger.error({
                message: 'FileContextGateStage execution failed',
                error,
                context: this.stageName,
                metadata: {
                    file: file.filename,
                    organizationId:
                        context.organizationAndTeamData.organizationId,
                },
            });
            return null;
        }
    }

    private buildAugmentations(
        results: Array<FileContextAgentResult | null>,
    ): ContextAugmentationsMap {
        const map: ContextAugmentationsMap = {};

        for (const result of results) {
            if (!result?.sandboxEvidences?.length) {
                continue;
            }

            for (const evidence of result.sandboxEvidences) {
                const pathKey =
                    (evidence.metadata?.pathKey as string | undefined) ??
                    this.resolvePathKeyFromMetadata(
                        evidence.metadata as
                            | Record<string, unknown>
                            | undefined,
                    );

                const key = pathKey ?? 'generation.main';
                if (!map[key]) {
                    map[key] = {
                        path: key.split('.'),
                        outputs: [],
                    };
                }

                map[key].outputs.push({
                    provider: evidence.provider,
                    toolName:
                        evidence.metadata?.toolName?.toString() ??
                        evidence.provider ??
                        'sandbox',
                    success: true,
                    output: this.serializeEvidence(evidence),
                });
            }
        }

        return map;
    }

    private mergeAugmentations(
        base: ContextAugmentationsMap,
        incoming: ContextAugmentationsMap,
    ): ContextAugmentationsMap {
        const result: ContextAugmentationsMap = { ...base };

        for (const [key, entry] of Object.entries(incoming)) {
            if (!result[key]) {
                result[key] = {
                    path: entry.path,
                    outputs: [...entry.outputs],
                };
                continue;
            }

            result[key].outputs = [...result[key].outputs, ...entry.outputs];
        }

        return result;
    }

    private serializeEvidence(evidence: ContextEvidence): string {
        if (typeof evidence.payload === 'string') {
            return evidence.payload;
        }

        try {
            return JSON.stringify(evidence.payload ?? evidence, null, 2);
        } catch {
            return String(evidence.payload ?? '[unserializable payload]');
        }
    }

    private extractMCPDependencies(dependencies?: ContextDependency[]): {
        dependencies: ContextMCPDependency[];
        lookup: Map<string, ContextMCPDependency>;
    } {
        const list: ContextMCPDependency[] = [];
        const lookup = new Map<string, ContextMCPDependency>();

        if (!dependencies?.length) {
            return { dependencies: list, lookup };
        }

        for (const dependency of dependencies) {
            if (!dependency || dependency.type !== 'mcp') {
                continue;
            }

            const provider = this.resolveDependencyProvider(dependency);
            const toolName = this.resolveDependencyTool(dependency);

            if (!provider || !toolName) {
                continue;
            }

            const metadataRecord = (dependency.metadata ?? {}) as Record<
                string,
                unknown
            >;

            const info: ContextMCPDependency = {
                provider,
                toolName,
                path: Array.isArray(dependency.metadata?.path)
                    ? (dependency.metadata?.path as string[])
                    : undefined,
                pathKey:
                    typeof dependency.metadata?.pathKey === 'string'
                        ? (dependency.metadata?.pathKey as string)
                        : undefined,
                requirementId:
                    typeof dependency.metadata?.requirementId === 'string'
                        ? (dependency.metadata?.requirementId as string)
                        : undefined,
                metadata: metadataRecord ?? undefined,
                descriptor: dependency.descriptor,
                schema: this.resolveDependencySchema(dependency),
                requiredArgs: this.resolveDependencyRequiredArgs(dependency),
                description: this.resolveDependencyDescription(dependency),
            };

            list.push(info);
            lookup.set(this.normalizeProviderToolKey(provider, toolName), info);
        }

        return { dependencies: list, lookup };
    }

    private getBasePromptOverrides(
        context: CodeReviewPipelineContext,
    ): CodeReviewConfig['v2PromptOverrides'] | undefined {
        return (
            getOverridesFromPack(context.sharedContextPack) ??
            context.codeReviewConfig?.v2PromptOverrides
        );
    }

    private resolvePromptOverridesForFile(
        baseOverrides: CodeReviewConfig['v2PromptOverrides'] | undefined,
        evidences: ContextEvidence[],
        dependencyLookup: Map<string, ContextMCPDependency>,
    ): CodeReviewConfig['v2PromptOverrides'] | undefined {
        if (!baseOverrides) {
            return undefined;
        }

        if (!evidences?.length || !dependencyLookup.size) {
            return baseOverrides;
        }

        const lookup = this.buildEvidenceLookup(evidences, dependencyLookup);
        if (!lookup.size) {
            return baseOverrides;
        }

        const clone = JSON.parse(
            JSON.stringify(baseOverrides),
        ) as CodeReviewConfig['v2PromptOverrides'];
        const replaced = this.replaceMarkersRecursive(
            clone,
            lookup,
            dependencyLookup,
        );

        return replaced as CodeReviewConfig['v2PromptOverrides'];
    }

    private buildEvidenceLookup(
        evidences: ContextEvidence[],
        dependencyLookup: Map<string, ContextMCPDependency>,
    ): Map<
        string,
        {
            result?: string;
            error?: string;
        }
    > {
        const map = new Map<string, { result?: string; error?: string }>();

        for (const evidence of evidences) {
            const provider = this.resolveEvidenceProvider(evidence);
            const toolName = this.resolveEvidenceTool(evidence);

            if (!provider || !toolName) {
                continue;
            }

            const key = this.normalizeProviderToolKey(provider, toolName);
            if (!dependencyLookup.has(key)) {
                continue;
            }

            const serialized = this.serializeEvidence(evidence);
            const existing = map.get(key);

            if (existing?.result) {
                existing.result = `${existing.result}\n---\n${serialized}`;
                continue;
            }

            map.set(key, {
                result: serialized,
            });
        }

        return map;
    }

    private resolveEvidenceProvider(
        evidence: ContextEvidence,
    ): string | undefined {
        const provider =
            (evidence.metadata?.provider as string | undefined) ??
            evidence.provider;
        return typeof provider === 'string'
            ? provider.trim().toLowerCase()
            : undefined;
    }

    private resolveEvidenceTool(evidence: ContextEvidence): string | undefined {
        const metadataTool =
            (evidence.metadata?.toolName as string | undefined) ??
            (evidence.metadata?.tool as string | undefined);
        if (metadataTool && typeof metadataTool === 'string') {
            return metadataTool.trim().toLowerCase();
        }

        return undefined;
    }

    private replaceMarkersRecursive(
        node: unknown,
        lookup: Map<string, { result?: string; error?: string }>,
        dependencyLookup: Map<string, ContextMCPDependency>,
        path: string[] = [],
    ): unknown {
        if (typeof node === 'string') {
            const parsed = this.tryParseJSON(node);
            if (parsed !== null) {
                const replaced = this.replaceMarkersRecursive(
                    parsed,
                    lookup,
                    dependencyLookup,
                    path,
                );
                return JSON.stringify(replaced);
            }
            return this.replaceMarkersInString(
                node,
                lookup,
                dependencyLookup,
                path.length ? pathToKey(path) : undefined,
            );
        }

        if (Array.isArray(node)) {
            return node
                .map((item) =>
                    this.replaceMarkersRecursive(
                        item,
                        lookup,
                        dependencyLookup,
                        path,
                    ),
                )
                .filter((item) => item !== undefined && item !== null);
        }

        if (node && typeof node === 'object') {
            const candidate = node as Record<string, unknown>;
            if (candidate.type === 'mcpMention') {
                return this.replaceMcpMentionNode(
                    candidate,
                    lookup,
                    dependencyLookup,
                    path.length ? pathToKey(path) : undefined,
                );
            }

            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(candidate)) {
                const nextPath = [...path, key];
                result[key] = this.replaceMarkersRecursive(
                    value,
                    lookup,
                    dependencyLookup,
                    nextPath,
                );
            }
            return result;
        }

        return node;
    }

    private replaceMarkersInString(
        text: string,
        lookup: Map<string, { result?: string; error?: string }>,
        dependencyLookup: Map<string, ContextMCPDependency>,
        pathKey?: string,
    ): string {
        const pattern = CODE_REVIEW_CONTEXT_PATTERNS.find(
            (p) => p.name === 'mcp',
        )?.regex;
        const markerPattern = pattern
            ? new RegExp(
                  pattern.source,
                  pattern.flags.includes('g')
                      ? pattern.flags
                      : `${pattern.flags}g`,
              )
            : /@mcp<([^|>]+)\|([^>]+)>/gi;

        return text.replace(markerPattern, (_, provider, tool) => {
            const replacement = this.resolveLookupReplacement(
                provider,
                tool,
                lookup,
                dependencyLookup,
                pathKey,
            );

            return (
                replacement ??
                `[context unavailable for ${provider?.trim()}|${tool?.trim()}]`
            );
        });
    }

    private replaceMcpMentionNode(
        node: Record<string, unknown>,
        lookup: Map<string, { result?: string; error?: string }>,
        dependencyLookup: Map<string, ContextMCPDependency>,
        pathKey?: string,
    ): Record<string, unknown> {
        const attrs = (node.attrs as Record<string, unknown>) ?? {};
        const provider = (attrs.app as string | undefined) ?? '';
        const toolName = (attrs.tool as string | undefined) ?? '';

        const replacement = this.resolveLookupReplacement(
            provider,
            toolName,
            lookup,
            dependencyLookup,
            pathKey,
        );

        if (!replacement) {
            return node;
        }

        return {
            ...node,
            attrs: {
                ...attrs,
                resolvedOutput: replacement,
                lastUpdatedAt: Date.now(),
            },
        };
    }

    private resolveLookupReplacement(
        provider: string,
        toolName: string,
        lookup: Map<string, { result?: string; error?: string }>,
        dependencyLookup: Map<string, ContextMCPDependency>,
        pathKey?: string,
    ): string | undefined {
        const key = this.normalizeProviderToolKey(provider, toolName);
        let entry = lookup.get(key);
        let dependency = dependencyLookup.get(key);

        // Fallback: if exact match fails, try to find a dependency with matching toolName and compatible pathKey
        if (!entry && !dependency) {
            const targetTool = toolName.trim().toLowerCase();
            for (const [depKey, dep] of dependencyLookup.entries()) {
                if (dep.toolName.toLowerCase() !== targetTool) {
                    continue;
                }

                // Check if pathKey matches loosely or exactly
                if (this.isPathKeyCompatible(dep.pathKey, pathKey)) {
                    entry = lookup.get(depKey);
                    dependency = dep;
                    break;
                }
            }
        }

        if (!entry || !dependency) {
            return undefined;
        }

        if (!this.isPathKeyCompatible(dependency.pathKey, pathKey)) {
            return undefined;
        }

        if (entry.result) {
            return entry.result;
        }

        if (entry.error) {
            return `[MCP ${toolName} failed: ${entry.error}]`;
        }

        return undefined;
    }

    private isPathKeyCompatible(
        dependencyPathKey?: string,
        targetPathKey?: string,
    ): boolean {
        if (!dependencyPathKey || !targetPathKey) {
            return true; // If either is missing, assume compatible (or strictness depends on reqs)
        }

        if (dependencyPathKey === targetPathKey) {
            return true;
        }

        // Check loose match for v2PromptOverrides prefix
        const depKey = dependencyPathKey.replace(/^v2PromptOverrides\./, '');
        const targetKey = targetPathKey.replace(/^v2PromptOverrides\./, '');

        return depKey === targetKey;
    }

    private tryParseJSON(value: string): unknown | null {
        if (!value) {
            return null;
        }

        const trimmed = value.trim();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            return null;
        }

        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }

    private buildRepositoryContext(context: CodeReviewPipelineContext): string {
        const lines: string[] = [];
        const repo = context.repository;

        if (repo) {
            const repoName = repo.fullName ?? repo.name ?? repo.id ?? 'unknown';
            lines.push(`- Repository: ${repoName}`);
            lines.push(`- Current branch: ${context.branch ?? 'unknown'}`);
        }

        const pr = context.pullRequest;
        if (pr) {
            if (pr.number !== undefined) {
                lines.push(`- Pull Request #: ${pr.number}`);
            }
            if (pr.title) {
                lines.push(`- Pull Request title: ${pr.title}`);
            }
            if (pr.base?.ref) {
                lines.push(`- Pull Request base branch: ${pr.base.ref}`);
            }
        }

        if (context.organizationAndTeamData?.organizationId) {
            lines.push(
                `- Organization ID: ${context.organizationAndTeamData.organizationId}`,
            );
        }
        if (context.correlationId) {
            lines.push(`- Correlation ID: ${context.correlationId}`);
        }

        return lines.length
            ? lines.join('\n')
            : '- Repository metadata not provided.';
    }

    private normalizeProviderToolKey(
        provider?: string,
        toolName?: string,
    ): string {
        return `${(provider ?? 'default').trim().toLowerCase()}|${(toolName ?? '').trim().toLowerCase()}`;
    }

    private attachPathKeyToEvidence(
        evidences: ContextEvidence[],
        dependencyLookup: Map<string, ContextMCPDependency>,
    ): ContextEvidence[] {
        return evidences.map((evidence) => {
            const metadata = {
                ...(evidence.metadata as Record<string, unknown> | undefined),
            };

            if (!metadata.toolName) {
                metadata.toolName =
                    this.resolveEvidenceTool(evidence) ?? metadata.toolName;
            }

            if (!metadata.provider) {
                metadata.provider =
                    evidence.provider ?? metadata.provider ?? undefined;
            }

            if (!metadata.pathKey) {
                const provider = this.resolveEvidenceProvider(evidence);
                const toolName = this.resolveEvidenceTool(evidence);
                if (provider && toolName) {
                    const dependency = dependencyLookup.get(
                        this.normalizeProviderToolKey(provider, toolName),
                    );
                    if (dependency?.pathKey) {
                        metadata.pathKey = dependency.pathKey;
                    }
                }
            }

            return {
                ...evidence,
                metadata,
            };
        });
    }

    private resolveDependencySchema(dependency: ContextDependency): unknown {
        const metadata = dependency.metadata as
            | Record<string, unknown>
            | undefined;
        if (metadata?.toolInputSchema) {
            return metadata.toolInputSchema;
        }

        if (
            dependency.descriptor &&
            typeof dependency.descriptor === 'object' &&
            (dependency.descriptor as Record<string, unknown>).schema
        ) {
            return (dependency.descriptor as Record<string, unknown>).schema;
        }

        return undefined;
    }

    private resolveDependencyDescription(
        dependency: ContextDependency,
    ): string | undefined {
        const metadata = dependency.metadata as
            | Record<string, unknown>
            | undefined;
        if (typeof metadata?.description === 'string') {
            return metadata.description;
        }

        if (
            dependency.descriptor &&
            typeof dependency.descriptor === 'object' &&
            typeof (dependency.descriptor as Record<string, unknown>)
                .description === 'string'
        ) {
            return (dependency.descriptor as Record<string, unknown>)
                .description as string;
        }

        return undefined;
    }

    private resolveDependencyRequiredArgs(
        dependency: ContextDependency,
    ): string[] | undefined {
        const metadata = dependency.metadata as
            | Record<string, unknown>
            | undefined;
        if (Array.isArray(metadata?.requiredArgs)) {
            return (metadata.requiredArgs as unknown[]).filter(
                (item): item is string => typeof item === 'string',
            );
        }

        return undefined;
    }

    private resolvePathKeyFromMetadata(
        metadata?: Record<string, unknown>,
    ): string | undefined {
        if (!metadata) {
            return undefined;
        }

        if (typeof metadata.pathKey === 'string') {
            return metadata.pathKey;
        }

        const category =
            typeof metadata.category === 'string'
                ? metadata.category.toLowerCase()
                : undefined;

        if (category === 'bug') {
            return 'categories.descriptions.bug';
        }

        if (category === 'performance') {
            return 'categories.descriptions.performance';
        }

        if (category === 'security') {
            return 'categories.descriptions.security';
        }

        return undefined;
    }

    private resolveDependencyProvider(
        dependency: ContextDependency,
    ): string | undefined {
        const metadata = dependency.metadata ?? {};
        if (typeof metadata.provider === 'string') {
            return metadata.provider.trim().toLowerCase();
        }
        if (typeof metadata.mcpId === 'string') {
            return metadata.mcpId.trim().toLowerCase();
        }
        const [provider] = dependency.id.split('|', 2);
        return provider?.trim().toLowerCase();
    }

    private resolveDependencyTool(
        dependency: ContextDependency,
    ): string | undefined {
        const metadata = dependency.metadata ?? {};
        if (typeof metadata.toolName === 'string') {
            return metadata.toolName.trim().toLowerCase();
        }
        if (typeof metadata.tool === 'string') {
            return metadata.tool.trim().toLowerCase();
        }
        const [, toolName] = dependency.id.split('|', 2);
        return toolName?.trim().toLowerCase();
    }
}
