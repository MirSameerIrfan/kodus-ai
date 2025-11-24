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

    private async createOrchestration() {
        const llmAdapter = super.createLLMAdapter(
            'ContextEvidenceAgent',
            'contextEvidenceAgent',
        );

        this.orchestration = await createOrchestration({
            tenantId: 'kodus-context-evidence-agent',
            llmAdapter,
            mcpAdapter: this.mcpAdapter,
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
    }

    private buildPrompt(
        file: FileChange,
        diffSnippet?: string,
        dependencies?: ContextMCPDependency[],
        promptOverrides?: CodeReviewConfig['v2PromptOverrides'],
        repoContext?: string,
    ): string {
        const linesChanged = file.patchWithLinesStr?.split('\n').length ?? 0;
        const dependencySection = this.formatDependencies(dependencies);
        const overridesSection = this.formatOverrides(promptOverrides);
        const metadataSection =
            repoContext && repoContext.trim().length
                ? repoContext.trim()
                : '- Repository metadata not provided.';
        return `You are a senior context analyst for code reviews. You must reason step by step, decide if any MCP tool should run, and publish structured evidences when acceleration data is valuable.

### Mission Priority
Your primary directive is to execute the specific instructions found in "Prompt Overrides".
You are tool-agnostic: if an override explicitly mentions ANY MCP tool or action (e.g. "MCP read_file", "check vulnerabilities", "query database", "search docs"), you MUST evaluate if the current file diff warrants that action using the available tools.

1. Check "Prompt Overrides": Do they ask for specific tools/context for this type of change?
2. Analyze Diff: Does this file change match the criteria in the overrides?
   - IMPORTANT: Focus STRICTLY on the 'diff snippet' and 'filename' provided below. Do not hallucinate changes not present in the diff.
   - Example A: User asks to "check security on deps changes". Diff is in 'package.json'. -> MATCH -> Execute Tool (e.g. security_scan).
   - Example B: User asks to "query performance metrics". Diff is a SQL query. -> MATCH -> Execute Tool (e.g. db_query).
   - Example C: User asks to "check security". Diff is 'styles.css'. -> NO MATCH -> Do nothing.

### Mission
1. Inspect the repository / PR context and the diff for this file.
2. Determine whether invoking an MCP tool adds meaningful context for the configured categories/severities. Many diffs (formatting, comments, docs) do **not** require MCP execution—detect these and return an empty evidence list.
3. If an MCP tool is justified, verify all required arguments. When any argument is unknown, attempt to discover it using the available tools; if still unavailable, skip the MCP and record the skip reason in the actions log.
4. Execute only the MCP tools that match the diff impact; avoid redundant or irrelevant calls.
5. Capture each successful tool execution as a ContextEvidence entry.
6. IMPORTANT: Do not call the same tool with the same arguments twice. If a tool fails or returns insufficient info, try a different approach or stop.

### Argument Resolution Strategy (Tool Agnostic)
When a required tool needs an argument you don't have (e.g. an ID, URI, hash, or specific path):
1. **Identify the Missing Argument:** Look at the tool's schema in <AVAILABLE TOOLS>.
2. **Extract Context from Diff:** Analyze function names, variable names, library imports, and comments in both the old and new code within the diff to find specific keywords to use as arguments for your tool calls.
3. **Search for a Resolver:** Check if any OTHER available tool can provide this information. Look for tools with verbs like 'get', 'list', 'resolve', 'find' or 'search' that might output the missing data.
4. **Chain Execution:** Execute the resolver tool first, extract the data from its result, and THEN execute the main tool.
   - *Generic Example:* Main tool 'fetch_data(id)' needs 'id'. Available tool 'find_id(name)' exists. -> Call 'find_id("target_name")' -> Get 'id' -> Call 'fetch_data(id)'.

### How to Read the Diff Snippet
The diff snippet uses a standard format to show changes. Pay close attention to both what was removed and what was added to understand the developer's intent.
- Lines starting with '-' represent the **old code** (what was deleted).
- Lines starting with '+' represent the **new code** (what was added).
- Lines without a prefix are unchanged context lines.
- **Your goal is to understand the transformation**: Compare the old code with the new code to identify the core logic change. For example, was a function call replaced? Was a variable renamed? Was a condition changed? This comparison is critical for your analysis.
- Note: The diff may sometimes use markers like '__old hunk__' and '__new hunk__' to explicitly separate the code before and after the change. Treat these as structural delimiters.

### ContextEvidence Schema
When creating evidences, use this structure:
{
  "provider": "string", // The tool provider or 'unknown'
  "toolName": "string", // The name of the tool executed
  "pathKey": "string", // Optional path key from dependencies or default
  "category": "string", // The category triggering this (e.g. 'bug', 'security')
  "severity": "string", // The severity level (e.g. 'high', 'medium')
  "payload": any // The actual result returned by the tool
}

### Repository / PR Context
${metadataSection}

### File Context
- filename: ${file.filename}
- status: ${file.status}
- additions: ${file.additions}
- deletions: ${file.deletions}
- total_lines_in_patch: ${linesChanged}
- diff snippet (may be truncated):
${diffSnippet ?? file.patchWithLinesStr ?? 'N/A'}

### MCP Dependencies (JSON)
${dependencySection}

### Prompt Overrides (category / severity / generation style)
${overridesSection}

### Output Format
When you have finished your analysis and tool executions (or decided no tools are needed), you MUST use the "final_answer" action.
The content of your final_answer MUST be a JSON object with this structure:
{
  "evidences": [ { ...ContextEvidence } ],
  "actionsLog": "optional step-by-step log"
}
`;
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
            return JSON.stringify(filtered, null, 2);
        } catch {
            return 'Failed to serialize overrides.';
        }
    }

    private filterRelevantOverrides(
        obj: any,
        keywords = ['mcp', 'tool', 'context', 'execut', 'run'],
    ): any {
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
            const result: Record<string, any> = {};
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
                    (dep.metadata as any)?.providerAlias || dep.provider;
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
                description: `Senior Context Intelligence Agent.
Specialized in augmenting code review context by dynamically orchestrating MCP tools based on file changes and user-defined rules.

Core Responsibilities:
- Analyze file diffs against "Prompt Overrides" to detect trigger conditions.
- Resolve dependencies: Identify missing arguments (e.g., URIs, IDs) and autonomously find them using available "resolver" tools.
- Execute MCP Tools: Select and run the most appropriate tools to gather high-value context (docs, security checks, performance metrics).
- Filter Noise: Distinguish between trivial changes (formatting) and significant logic changes that warrant deep context gathering.
- Produce Evidence: Synthesize tool outputs into structured "ContextEvidence" JSON for downstream consumption.

Mindset:
- You are a detective, not just a script runner.
- You assume nothing; you verify everything via tools.
- You are persistent in resolving arguments but conservative in execution (avoiding redundant calls).`,
                goal: 'Reason about each file, gather the needed arguments, invoke the appropriate MCP tools, and publish the evidences.',
                expertise: [
                    'Codebase Context Analysis',
                    'Tool Orchestration and Chaining',
                    'Dynamic Requirement Interpretation',
                    'Gap Analysis and Information Retrieval',
                ],
                personality:
                    'Analytical, precise, tool-agnostic, and resource-efficient. You do not guess; you investigate using tools. You prioritize gathering concrete data over making assumptions.',
            },
            plannerOptions: {
                type: PlannerType.REACT,
                replanPolicy: {
                    toolUnavailable: 'replan',
                    maxReplans: 2,
                },
                scratchpad: {
                    enabled: true,
                    initialState: `# EXECUTION PLAN (Status: Initializing)

## 1. TRIGGER ANALYSIS
[ ] Check if "Prompt Overrides" request specific tools.
[ ] Compare file diff with triggers.
> Triggers Found: null

## 2. DEPENDENCY RESOLUTION
[ ] List missing tool arguments (IDs, URIs, etc).
[ ] Execute search/resolver tools to find these arguments.
> Missing Arguments: []
> Resolved Arguments: {}

## 3. EVIDENCE COLLECTION
[ ] Execute main tools.
[ ] Validate if output is useful context.
> Collected Evidences: []

## 4. FINALIZATION
[ ] Format output as JSON.
[ ] Call final_answer.`,
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
    }): Promise<ContextEvidenceAgentResult | null> {
        const {
            organizationAndTeamData,
            file,
            dependencies,
            promptOverrides,
            repoContext,
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
