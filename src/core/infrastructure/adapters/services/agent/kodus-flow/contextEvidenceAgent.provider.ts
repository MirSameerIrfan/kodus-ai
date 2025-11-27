import { Injectable } from '@nestjs/common';
import {
    createMCPAdapter,
    createOrchestration,
    createThreadId,
    PlannerType,
    StorageEnum,
    EnhancedJSONParser,
    createLogger,
} from '@kodus/flow';
import { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
import { ConfigService } from '@nestjs/config';
import { DatabaseConnection } from '@/config/types';
import { LLMModelProvider, PromptRunnerService } from '@kodus/kodus-common/llm';
import { SDKOrchestrator } from '@kodus/flow/dist/orchestration';
import { ObservabilityService } from '../../logger/observability.service';
import { PermissionValidationService } from '@/ee/shared/services/permissionValidation.service';
import { MCPManagerService } from '../../../mcp/services/mcp-manager.service';
import { BaseAgentProvider } from './base-agent.provider';
import type {
    CodeReviewConfig,
    FileChange,
} from '@/config/types/general/codeReview.type';
import type { ContextEvidence } from '@context-os-core/interfaces';
import { IKodyRule } from '@/core/domain/kodyRules/interfaces/kodyRules.interface';

export interface ContextEvidenceAgentResult {
    evidences?: ContextEvidence[];
    actionsLog?: string;
}

export interface ContextMCPDependency {
    provider: string;
    toolName: string;
    pathKey?: string;
    path?: string[];
    requirementId?: string;
    metadata?: Record<string, unknown>;
    descriptor?: unknown;
    schema?: unknown;
    requiredArgs?: string[];
    description?: string;
}

@Injectable()
export class ContextEvidenceAgentProvider extends BaseAgentProvider {
    private readonly logger = createLogger(ContextEvidenceAgentProvider.name);
    protected config: DatabaseConnection;
    private orchestration: SDKOrchestrator | null = null;
    private mcpAdapter: ReturnType<typeof createMCPAdapter>;
    private initializing: Promise<void> | null = null;

    protected readonly defaultLLMConfig = {
        llmProvider: LLMModelProvider.GEMINI_2_5_PRO,
        temperature: 0,
        maxTokens: 60000,
        maxReasoningTokens: 1000,
        stop: undefined as string[] | undefined,
    };

    constructor(
        private readonly configService: ConfigService,
        promptRunnerService: PromptRunnerService,
        permissionValidationService: PermissionValidationService,
        observabilityService: ObservabilityService,
        private readonly mcpManagerService: MCPManagerService
    ) {
        super(
            promptRunnerService,
            permissionValidationService,
            observabilityService,
        );
        this.config =
            this.configService.get<DatabaseConnection>('mongoDatabase');
    }

    protected async createMCPAdapter(
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<void> {
        const mcpManagerServers = await this.mcpManagerService.getConnections(
            organizationAndTeamData,
        );

        const servers = [...mcpManagerServers];

        this.mcpAdapter = createMCPAdapter({
            servers,
            defaultTimeout: 15_000,
            maxRetries: 1,
            onError: (error) => {
                this.logger.warn({
                    message:
                        'ContextEvidenceAgent: MCP execution failed, continuing.',
                    context: ContextEvidenceAgentProvider.name,
                    error,
                });
            },
        });
    }

    private buildPrompt(
        file: FileChange,
        diffSnippet?: string,
        dependencies?: ContextMCPDependency[],
        promptOverrides?: CodeReviewConfig['v2PromptOverrides'],
        repoContext?: string,
        kodyRule?: Partial<IKodyRule>,
    ): string {
        const dependencySection = this.formatDependencies(dependencies);
        const repoSection =
            repoContext && repoContext.trim().length
                ? repoContext.trim()
                : '- Repository metadata not provided.';

        const directiveSection = kodyRule
            ? this.buildKodyRuleDirective(kodyRule)
            : this.buildOverridesDirective(promptOverrides);

        const toolNames =
            dependencies?.map((d) => `\`${d.toolName}\``).join(', ') || 'none';

        // ============================================================
        // PROMPT STRUCTURE (based on prompt engineering best practices)
        // ============================================================
        // Note: IDENTITY and SCRATCHPAD are injected by the orchestrator.
        // This prompt contains only the task-specific instructions.
        //
        // Structure:
        // 1. DIRECTIVE (what the user wants - critical context first)
        // 2. TASK CONTEXT (file, diff, repo info)
        // 3. REQUIRED TOOLS (dependencies with schemas)
        // 4. STOPPING CRITERIA + OUTPUT FORMAT (recency bias)
        //
        // <AVAILABLE TOOLS> is injected by the orchestrator after this.
        // ============================================================

        return `${directiveSection}

## 📋 TASK CONTEXT

### Repository / PR Info
${repoSection}

### File Change
| Field | Value |
|-------|-------|
| File | \`${file.filename}\` |
| Status | ${file.status} |
| Lines | +${file.additions} / -${file.deletions} |

### Diff
\`\`\`diff
${diffSnippet ?? file.patchWithLinesStr ?? 'N/A'}
\`\`\`

> **Reading the diff:** \`-\` = deleted, \`+\` = added, no prefix = context

## 🔧 REQUIRED TOOLS (${toolNames})

For each tool below:
1. **Check availability** in \`<AVAILABLE TOOLS>\` → if missing, skip with \`"tool_not_available"\`
2. **Resolve arguments** using the schema and context
3. **Execute** and capture result

### How to Resolve Arguments (Tool-Agnostic)

**IMPORTANT:** You don't know what tools will be available. Read each tool's **schema**, \`description\` and \`<hints>\` to understand its arguments.

**Your process:**
1. **Read the schema:** Look at \`required\` args, \`properties\`, and each property's \`description\` — it tells you exactly what the tool expects
2. **Read instructions:** Check the tool's \`description\` and \`<hints>\` for specific usage patterns
3. **Resolve missing args:** Use the suggested resolver tools if arguments are missing
4. **Extract from context:** Use values from diff, file path, repo info, PR info

**Key rules:**
- Use **REAL values** from context — never invent terms
- If a resolver tool returns no results with a query → try without query
- Only skip with \`"args_unresolvable"\` after following the tool's hints

### Tool Schemas
${dependencySection}

## 🛑 STOPPING CRITERIA

**STOP when:**
- ✅ All required tools processed (executed or skipped)
- ✅ No tools needed for this change
- ✅ Tool failed → report and stop (no retry with same args)

**SKIP when:**
| Reason | skipReason |
|--------|------------|
| Not in \`<AVAILABLE TOOLS>\` | \`"tool_not_available"\` |
| Can't resolve args | \`"args_unresolvable"\` |
| Context wouldn't help | \`"not_needed_for_this_change"\` |
| Directive doesn't apply | \`"change_unrelated_to_request"\` |

**NEVER:** Retry same args, loop indefinitely, or execute tools blindly.

## ✅ OUTPUT FORMAT

\`\`\`json
{
  "reasoning": "What is this change? Do I need context? Why/why not?",
  "evidences": [
    {
      "provider": "string",
      "toolName": "string",
      "pathKey": "string",
      "payload": "<result or null>",
      "metadata": {
        "executionStatus": "success" | "failed" | "skipped",
        "skipReason": "string or null"
      }
    }
  ],
  "actionsLog": "Step-by-step log"
}
\`\`\`
`;
    }

    /**
     * Builds the directive section for KodyRule context.
     * KodyRule has title + rule fields.
     */
    private buildKodyRuleDirective(kodyRule: Partial<IKodyRule>): string {
        return `## 📌 DIRECTIVE: KodyRule Validation

You are validating this code change against a specific rule.

**Rule:** ${kodyRule.title}
**Description:** ${kodyRule.rule}

Consider: Does this change touch anything related to this rule? Would external context help validate compliance?`;
    }

    /**
     * Builds the directive section for PromptOverrides context.
     * PromptOverrides contains user custom instructions (deserializes TipTap JSON).
     */
    private buildOverridesDirective(
        promptOverrides?: CodeReviewConfig['v2PromptOverrides'],
    ): string {
        const overridesContent = this.formatOverrides(promptOverrides);
        if (
            overridesContent.includes('No overrides provided') ||
            overridesContent.includes('No relevant overrides provided')
        ) {
            return `## 📌 DIRECTIVE: Standard Review

No specific context request. Use your judgment as a senior engineer to decide if external context would help.`;
        }

        return `## 📌 DIRECTIVE: User Request

The user is asking for specific context:

${overridesContent}

Consider: Does this request make sense for THIS particular change?`;
    }
    private formatDependencies(dependencies?: ContextMCPDependency[]): string {
        if (!dependencies?.length) {
            return '[]';
        }

        try {
            const summarized = dependencies.map((dependency) => ({
                provider: dependency.provider,
                toolName: dependency.toolName,
                pathKey: dependency.pathKey ?? 'generation.main',
                requiredArgs: dependency.requiredArgs ?? [],
                description: dependency.description ?? null,
                schema:
                    dependency.schema ??
                    dependency.metadata?.toolInputSchema ??
                    null,
            }));

            return JSON.stringify(summarized, null, 2);
        } catch {
            return dependencies
                .map(
                    (dependency, index) =>
                        `${index + 1}. ${dependency.provider || 'unknown'}::${dependency.toolName || 'unknown'} (path: ${dependency.pathKey ?? 'n/a'})`,
                )
                .join('\n');
        }
    }

    private formatOverrides(
        overrides?: CodeReviewConfig['v2PromptOverrides'],
    ): string {
        if (!overrides) {
            return 'No overrides provided.';
        }

        try {
            const filtered = this.filterRelevantOverrides(overrides);
            if (!filtered || Object.keys(filtered).length === 0) {
                return 'No relevant overrides provided.';
            }
            return this.deserializeNestedJson(filtered);
        } catch {
            return 'Failed to serialize overrides.';
        }
    }

    private deserializeNestedJson(obj: unknown): string {
        if (typeof obj === 'string') {
            const trimmed = obj.trim();
            if (
                (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                (trimmed.startsWith('[') && trimmed.endsWith(']'))
            ) {
                try {
                    const parsed = JSON.parse(trimmed);
                    return this.extractTextFromTipTap(parsed);
                } catch {
                    return obj;
                }
            }
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj
                .map((item) => this.deserializeNestedJson(item))
                .join('\n');
        }

        if (obj && typeof obj === 'object') {
            const lines: string[] = [];
            for (const [key, value] of Object.entries(obj)) {
                const deserializedValue = this.deserializeNestedJson(value);
                if (deserializedValue.trim()) {
                    lines.push(`**${key}:**\n${deserializedValue}`);
                }
            }
            return lines.join('\n\n');
        }

        return String(obj);
    }

    private extractTextFromTipTap(node: unknown): string {
        if (!node || typeof node !== 'object') {
            return '';
        }

        const typedNode = node as Record<string, unknown>;

        if (typedNode.type === 'text' && typeof typedNode.text === 'string') {
            return typedNode.text;
        }

        if (typedNode.type === 'hardBreak') {
            return '\n';
        }

        if (typedNode.type === 'mcpMention') {
            const attrs = typedNode.attrs as Record<string, string> | undefined;
            if (attrs?.app && attrs?.tool) {
                return `→ Tool: ${attrs.app}/${attrs.tool}`;
            }
            return '';
        }

        if (Array.isArray(typedNode.content)) {
            return typedNode.content
                .map((child) => this.extractTextFromTipTap(child))
                .join('');
        }

        return '';
    }

    private filterRelevantOverrides(
        obj: unknown,
        keywords = ['mcp', 'tool', 'context', 'execut', 'run'],
    ): unknown {
        if (typeof obj === 'string') {
            const lower = obj.toLowerCase();
            if (keywords.some((k) => lower.includes(k))) {
                return obj;
            }
            return undefined;
        }

        if (Array.isArray(obj)) {
            const filtered = obj
                .map((item) => this.filterRelevantOverrides(item, keywords))
                .filter((item) => item !== undefined);
            return filtered.length ? filtered : undefined;
        }

        if (obj && typeof obj === 'object') {
            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj)) {
                const filteredValue = this.filterRelevantOverrides(
                    value,
                    keywords,
                );
                if (filteredValue !== undefined) {
                    result[key] = filteredValue;
                }
            }
            return Object.keys(result).length ? result : undefined;
        }

        return undefined;
    }

    private parseAgentResponse(
        response: unknown,
    ): ContextEvidenceAgentResult | null {
        if (!response) {
            return null;
        }

        const text =
            typeof response === 'string'
                ? response
                : JSON.stringify(response, null, 2);

        try {
            const parsed: any = EnhancedJSONParser.parse(text);

            if (!parsed) {
                if (
                    text.trim().startsWith('{') ||
                    text.trim().startsWith('[')
                ) {
                    const preview =
                        text.length > 200
                            ? text.substring(0, 200) + '...'
                            : text;
                    return {
                        evidences: [],
                        actionsLog: `Failed to parse agent response (EnhancedParser returned null). payload_preview=${JSON.stringify(preview)}`,
                    };
                }
                return null;
            }

            const evidences = Array.isArray(parsed.evidences)
                ? (parsed.evidences as ContextEvidence[])
                : undefined;

            return {
                evidences,
                actionsLog:
                    typeof parsed.actionsLog === 'string'
                        ? parsed.actionsLog
                        : typeof parsed.actions === 'string'
                          ? parsed.actions
                          : undefined,
            };
        } catch (error) {
            const message =
                typeof error?.message === 'string'
                    ? error.message
                    : String(error);

            this.logger.warn({
                message: 'ContextEvidenceAgent: failed to parse response',
                error,
                context: ContextEvidenceAgentProvider.name,
                metadata: { responseText: text },
            });

            if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                const preview =
                    text.length > 200 ? text.substring(0, 200) + '...' : text;
                return {
                    evidences: [],
                    actionsLog: `Failed to parse agent response. error=${message}. payload_preview=${JSON.stringify(preview)}`,
                };
            }
            return null;
        }
    }

    private async createEphemeralOrchestrator(
        organizationAndTeamData: OrganizationAndTeamData,
        dependencies?: ContextMCPDependency[],
    ) {
        const mcpManagerServers = await this.mcpManagerService.getConnections(
            organizationAndTeamData,
        );

        const requiredServerNames = new Set<string>();

        if (dependencies) {
            for (const dep of dependencies) {
                const serverName =
                    (dep.metadata as any)?.providerName ||
                    (dep.metadata as any)?.providerAlias ||
                    dep.provider;
                if (serverName) {
                    requiredServerNames.add(serverName.toLowerCase());
                }
            }
        }

        requiredServerNames.add('kodus mcp');

        const servers = mcpManagerServers.filter((server) => {
            const serverName = server.name.toLowerCase();
            return requiredServerNames.has(serverName);
        });

        const mcpAdapter = createMCPAdapter({
            servers,
            defaultTimeout: 15_000,
            maxRetries: 1,
            onError: (error) => {
                this.logger.warn({
                    message:
                        'ContextEvidenceAgent: MCP execution failed, continuing.',
                    context: ContextEvidenceAgentProvider.name,
                    error,
                });
            },
        });

        const llmAdapter = super.createLLMAdapter(
            'ContextEvidenceAgent',
            'contextEvidenceAgent',
        );

        const orchestration = await createOrchestration({
            tenantId: 'kodus-context-evidence-agent',
            llmAdapter,
            mcpAdapter,
            observability:
                this.observabilityService.createAgentObservabilityConfig(
                    this.config,
                    'context-script-agent',
                ),
            storage: {
                type: StorageEnum.MONGODB,
                connectionString:
                    this.observabilityService.buildConnectionString(
                        this.config,
                    ),
                database: this.config.database,
            },
        });

        await orchestration.connectMCP();
        await orchestration.registerMCPTools();

        await orchestration.createAgent({
            name: 'kodus-context-script-agent',
            llmDefaults: {
                model: this.defaultLLMConfig.llmProvider,
                temperature: this.defaultLLMConfig.temperature,
                maxTokens: this.defaultLLMConfig.maxTokens,
                maxReasoningTokens: this.defaultLLMConfig.maxReasoningTokens,
                stop: this.defaultLLMConfig.stop,
            },
            identity: {
                description:
                    'Context Evidence Agent. Analyzes code diffs, resolves tool arguments from context, executes MCP tools to gather relevant external context for code reviews.',
                goal: 'Fetch external context (issues, docs, security) that genuinely helps review this code change.',
                expertise: ['Code Review', 'Tool Orchestration'],
                personality:
                    'Analytical, precise. Verifies via tools, no assumptions.',
            },
            plannerOptions: {
                type: PlannerType.REACT,
                replanPolicy: {
                    toolUnavailable: 'fail',
                    maxReplans: 1,
                },
                scratchpad: {
                    enabled: true,
                    initialState: `**1. Change:** (what is this diff doing? trivial or significant?)
**2. Directive:** (what context is requested? applies to this change?)
**3. Tools:** execute=[] skip=[]
**4. Args:** (how resolved each required arg)
**5. Log:** (execution results)`,
                },
            },
        });

        return orchestration;
    }

    async execute(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        file: FileChange;
        dependencies?: ContextMCPDependency[];
        promptOverrides?: CodeReviewConfig['v2PromptOverrides'];
        repoContext?: string;
        kodyRule?: Partial<IKodyRule>;
    }): Promise<ContextEvidenceAgentResult | null> {
        const {
            organizationAndTeamData,
            file,
            dependencies,
            promptOverrides,
            repoContext,
            kodyRule,
        } = params;

        this.logger.log({
            message: 'Starting context evidence collection for file',
            context: ContextEvidenceAgentProvider.name,
            serviceName: ContextEvidenceAgentProvider.name,
            metadata: {
                organizationId: organizationAndTeamData?.organizationId,
                teamId: organizationAndTeamData?.teamId,
                fileName: file.filename,
                dependenciesCount: dependencies?.length || 0,
                hasPromptOverrides: !!promptOverrides,
                hasRepoContext: !!repoContext,
            },
        });

        if (!organizationAndTeamData) {
            throw new Error(
                'Organization and team data is required for context evidence collection.',
            );
        }

        if (!dependencies?.length) {
            return null;
        }

        await this.fetchBYOKConfig(organizationAndTeamData);

        const orchestration = await this.createEphemeralOrchestrator(
            organizationAndTeamData,
            dependencies,
        );

        const thread = createThreadId(
            {
                organizationId: organizationAndTeamData.organizationId,
                file: file.filename,
            },
            { prefix: 'csa' },
        );

        const prompt = this.buildPrompt(
            file,
            file.patchWithLinesStr ?? file.patch ?? undefined,
            dependencies,
            promptOverrides,
            repoContext,
            kodyRule,
        );

        const result = await orchestration.callAgent(
            'kodus-context-script-agent',
            prompt,
            {
                thread,
                userContext: {
                    organizationAndTeamData,
                    fileName: file.filename,
                },
            } as any,
        );

        const agentOutput =
            (result as { result?: unknown })?.result ?? result ?? null;
        return this.parseAgentResponse(agentOutput);
    }
}
