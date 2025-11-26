import { Injectable } from '@nestjs/common';
import {
    createMCPAdapter,
    createOrchestration,
    createThreadId,
    PlannerType,
    StorageEnum,
    EnhancedJSONParser,
} from '@kodus/flow';
import { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
import { ConfigService } from '@nestjs/config';
import { DatabaseConnection } from '@/config/types';
import { LLMModelProvider, PromptRunnerService } from '@kodus/kodus-common/llm';
import { SDKOrchestrator } from '@kodus/flow/dist/orchestration';
import { PinoLoggerService } from '../../logger/pino.service';
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
import { convertTiptapJSONToText } from '@/core/utils/tiptap-json';

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
        private readonly logger: PinoLoggerService,
        permissionValidationService: PermissionValidationService,
        observabilityService: ObservabilityService,
        private readonly mcpManagerService: MCPManagerService,
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
        dependencies?: ContextMCPDependency[],
        promptOverrides?: CodeReviewConfig['v2PromptOverrides'],
        kodyRule?: Partial<IKodyRule>,
    ): string {
        const diffSnippet = file.patchWithLinesStr ?? file.patch ?? 'N/A';

        const missionToolsSection = this.formatDependencies(dependencies);

        const missionToolNames =
            dependencies?.map((d) => `\`${d.toolName}\``).join(', ') || 'none';

        const directiveSection = kodyRule
            ? this.buildKodyRuleDirective(kodyRule)
            : this.buildOverridesDirective(promptOverrides);

        return `${directiveSection}

### Diff
\`\`\`diff
${diffSnippet}
\`\`\`

> **Reading the diff:** \`-\` = deleted, \`+\` = added, no prefix = context

## 🚀 YOUR MISSION & EXECUTION PLAN
Your mission is to act as a senior engineering assistant. Your goal is to decide if external context is needed for this code review and, if so, to fetch it. Follow this exact plan:

**Step 1: Triage & Initial Assessment**
-   **Analyze the code change ('Diff') and the user's request ('DIRECTIVE').**
-   **Make a critical decision:** Is external context *genuinely useful* for reviewing this specific code change?
    -   *Example of USEFUL:* A bug fix that mentions an issue ID. The directive asks for Sentry logs. This is a good match.
    -   *Example of NOT USEFUL:* A typo fix in a comment. The directive asks for performance metrics. This is unrelated.
-   **If context is NOT useful or the directive is unrelated, your mission is complete.** You will skip all tools and explain your reasoning in the final JSON output (\`skipReason: "not_needed_for_this_change"\` or \`"change_unrelated_to_request"\`).

**Step 2: Plan your data collection (Only if Step 1 passed)**
-   Review the 'MISSION TOOLS' below. These are the pieces of evidence you need to collect.
-   For each tool, check if you have all the required arguments from the provided context (Repository Info, PR Details, etc.).

**Step 3: Execute & Recover (The main loop)**
-   For each 'MISSION TOOL':
    -   If you have the arguments, execute it.
    -   If an argument is missing, search the '<AVAILABLE TOOLS>' list for a helper tool. Execute it to find the missing value, then retry the mission tool.
    -   If a tool fails, follow the 'ERROR HANDLING' protocol to diagnose and attempt recovery.

**Step 4: Report your findings**
-   Once all necessary tools have been run or justifiably skipped, provide your final report in the 'OUTPUT FORMAT'.

## 🎯 MISSION TOOLS (${missionToolNames})
If your initial assessment determines they are needed, your goal is to execute these tools.

${missionToolsSection}

## 🛑 STOPPING CRITERIA

**STOP when:**
- ✅ All required tools processed (executed or skipped)
- ✅ No tools needed for this change

**SKIP when:**
| Reason | skipReason |
|--------|------------|
| Not in \`<AVAILABLE TOOLS>\` | \`"tool_not_available"\` |
| Can't resolve args | \`"args_unresolvable"\` |
| Context wouldn't help | \`"not_needed_for_this_change"\` |
| Directive doesn't apply | \`"change_unrelated_to_request"\` |

## 🚨 ERROR HANDLING
- **If a tool fails:**
    1.  **Analyze the error message.**
    2.  Is it a resolvable issue (e.g., a "Not Found" error on an ID)?
    3.  If YES → Your next action MUST be to use a different tool to find the correct value and then retry.
    4.  If NO (e.g., authentication error, fatal bug) → Report the failure in your final output and STOP.
- **NEVER** retry a tool with the exact same arguments that previously failed.
- **NEVER** loop indefinitely. If a recovery attempt fails, STOP.

## ✅ OUTPUT FORMAT
When you have completed your mission and processed all required tools, provide your final response as a single JSON object. No other text or explanation outside the JSON.
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

    private buildKodyRuleDirective(kodyRule: Partial<IKodyRule>): string {
        return `## 📌 DIRECTIVE: KodyRule Validation

You are validating this code change against a specific rule.

**Rule:** ${kodyRule.title}
**Description:** ${kodyRule.rule}

Consider: Does this change touch anything related to this rule? Would external context help validate compliance?`;
    }

    private buildOverridesDirective(
        promptOverrides?: CodeReviewConfig['v2PromptOverrides'],
    ): string {
        if (!promptOverrides) {
            return `## 📌 DIRECTIVE: Standard Review
No specific context request. Use your judgment as a senior engineer to decide if external context would help.`;
        }

        const overridesContent = this.deserializeNestedJson(promptOverrides);

        if (!overridesContent.trim()) {
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

    private deserializeNestedJson(obj: unknown): string {
        if (typeof obj === 'string') {
            const trimmed = obj.trim();
            if (
                (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                (trimmed.startsWith('[') && trimmed.endsWith(']'))
            ) {
                try {
                    const parsed = JSON.parse(trimmed);
                    return convertTiptapJSONToText(parsed);
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

        return String(obj ?? '');
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
            defaultTimeout: 60_000,
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
            name: 'kodus-context-evidence-agent',
            llmDefaults: {
                model: this.defaultLLMConfig.llmProvider,
                temperature: this.defaultLLMConfig.temperature,
                maxTokens: this.defaultLLMConfig.maxTokens,
                maxReasoningTokens: this.defaultLLMConfig.maxReasoningTokens,
                stop: this.defaultLLMConfig.stop,
            },
            identity: {
                description:
                    'Specialist Code Analysis Engineer. Your role is to meticulously analyze code changes, determine if external information is necessary for a comprehensive review, and autonomously use tools to retrieve that information. You operate with precision and make decisions based on evidence.',
                goal: 'Your primary objective is to enrich the code review process by fetching relevant external context (e.g., from issue trackers, documentation, or security dashboards). Your goal is to ensure that code reviewers have all the necessary information to make informed decisions, improving code quality and reducing risks. You will only provide the final JSON output when your mission is fully complete.',
                expertise: [
                    'Code Review',
                    'Static Analysis',
                    'Tool Orchestration',
                    'Contextual Data Retrieval',
                ],
                personality:
                    'Methodical, analytical, and autonomous. You do not make assumptions; you verify through tool-based evidence. You are proactive in identifying information gaps and relentless in filling them.',
            },
            plannerOptions: {
                type: PlannerType.REACT,
                replanPolicy: {
                    toolUnavailable: 'fail',
                    maxReplans: 1,
                },
                scratchpad: {
                    enabled: true,
                    initialState: `Thought: I need to analyze the user's directive and the code changes to determine if external context is required. I will start by assessing the goal and the provided diff.

My execution plan is:
1. Triage & Initial Assessment (Current Focus)
2. Plan data collection (if context is useful)
3. Execute & Recover (fetch evidence)
4. Report findings`,
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
        additionalContext?: Record<string, unknown>;
        kodyRule?: Partial<IKodyRule>;
    }): Promise<ContextEvidenceAgentResult | null> {
        const {
            organizationAndTeamData,
            file,
            dependencies,
            promptOverrides,
            additionalContext,
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
            dependencies,
            promptOverrides,
            kodyRule,
        );

        const result = await orchestration.callAgent(
            'kodus-context-evidence-agent',
            prompt,
            {
                thread,
                userContext: {
                    organizationAndTeamData,
                    additional_information: additionalContext,
                },
            } as any,
        );

        const agentOutput =
            (result as { result?: unknown })?.result ?? result ?? null;
        return this.parseAgentResponse(agentOutput);
    }
}
