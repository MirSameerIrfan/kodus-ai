// import { Injectable } from '@nestjs/common';
// import {
//     createMCPAdapter,
//     createOrchestration,
//     createThreadId,
//     PlannerType,
//     StorageEnum,
// } from '@kodus/flow';
// import { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
// import { ConfigService } from '@nestjs/config';
// import { DatabaseConnection } from '@/config/types';
// import { LLMModelProvider, PromptRunnerService } from '@kodus/kodus-common/llm';
// import { SDKOrchestrator } from '@kodus/flow/dist/orchestration';
// import { PinoLoggerService } from '../../logger/pino.service';
// import { ObservabilityService } from '../../logger/observability.service';
// import { PermissionValidationService } from '@/ee/shared/services/permissionValidation.service';
// import { MCPManagerService } from '../../../mcp/services/mcp-manager.service';
// import { BaseAgentProvider } from './base-agent.provider';
// import type { FileChange } from '@/config/types/general/codeReview.type';
// import type { FileContextAgentResult } from '../../codeBase/codeReviewPipeline/context/code-review-pipeline.context';

// @Injectable()
// export class FileContextAgentProvider extends BaseAgentProvider {
//     protected config: DatabaseConnection;
//     private orchestration: SDKOrchestrator | null = null;
//     private mcpAdapter: ReturnType<typeof createMCPAdapter> | null = null;

//     protected readonly defaultLLMConfig = {
//         llmProvider: LLMModelProvider.GEMINI_2_5_PRO,
//         temperature: 0,
//         maxTokens: 12000,
//         maxReasoningTokens: 800,
//         stop: undefined as string[] | undefined,
//     };

//     constructor(
//         private readonly configService: ConfigService,
//         promptRunnerService: PromptRunnerService,
//         private readonly logger: PinoLoggerService,
//         permissionValidationService: PermissionValidationService,
//         observabilityService: ObservabilityService,
//         private readonly mcpManagerService: MCPManagerService,
//     ) {
//         super(
//             promptRunnerService,
//             permissionValidationService,
//             observabilityService,
//         );
//         this.config =
//             this.configService.get<DatabaseConnection>('mongoDatabase');
//     }

//     protected async createMCPAdapter(
//         organizationAndTeamData: OrganizationAndTeamData,
//     ): Promise<void> {
//         const servers = await this.mcpManagerService.getConnections(
//             organizationAndTeamData,
//         );

//         this.mcpAdapter = createMCPAdapter({
//             servers,
//             defaultTimeout: 15_000,
//             maxRetries: 1,
//             onError: (error) => {
//                 this.logger.warn({
//                     message:
//                         'FileContextAgent MCP execution failed, continuing without MCP.',
//                     context: FileContextAgentProvider.name,
//                     error,
//                 });
//             },
//         });
//     }

//     private async createOrchestration() {
//         const llmAdapter = super.createLLMAdapter(
//             'FileContextAgent',
//             'fileContextAgent',
//         );

//         this.orchestration = await createOrchestration({
//             tenantId: 'kodus-file-context-agent',
//             llmAdapter,
//             mcpAdapter: this.mcpAdapter ?? undefined,
//             observability:
//                 this.observabilityService.createAgentObservabilityConfig(
//                     this.config,
//                     'kodus-file-context-agent',
//                 ),
//             storage: {
//                 type: StorageEnum.MONGODB,
//                 connectionString:
//                     this.observabilityService.buildConnectionString(
//                         this.config,
//                     ),
//                 database: this.config.database,
//             },
//         });
//     }

//     private async initialize(organizationAndTeamData: OrganizationAndTeamData) {
//         await this.createMCPAdapter(organizationAndTeamData);
//         await this.createOrchestration();

//         if (!this.orchestration) {
//             throw new Error('Failed to initialize orchestration');
//         }

//         try {
//             await this.orchestration.connectMCP();
//             await this.orchestration.registerMCPTools();
//         } catch (error) {
//             this.logger.warn({
//                 message:
//                     'FileContextAgent: failed to connect/register MCP tools',
//                 context: FileContextAgentProvider.name,
//                 error,
//             });
//         }

//         await this.orchestration.createAgent({
//             name: 'kodus-file-context-agent',
//             identity: {
//                 description:
//                     'Specialized agent that inspects file diffs and determines which review categories (bug, performance, security, docs) require attention. When necessary, it runs MCP tools to collect additional evidence/logs/context for those categories.',
//                 goal: 'Classify code diffs by review category and gather targeted context (via MCP tools) to assist downstream analysis.',
//             },
//             plannerOptions: {
//                 type: PlannerType.REACT,
//                 replanPolicy: {
//                     toolUnavailable: 'replan',
//                     maxReplans: 2,
//                 },
//             },
//         });
//     }

//     private buildPrompt(file: FileChange, diffSnippet?: string): string {
//         const linesChanged = file.patchWithLinesStr?.split('\n').length ?? 0;
//         return `
// You are a Context OS agent that inspects code diffs file-by-file.

// Instructions:
// - Examine the provided file metadata and diff snippet.
// - Determine which review categories apply: bug, security, performance, documentation. You may return multiple categories.
// - Whenever a category applies, gather short actionable findings (max 3 bullet points) that justify why the category is relevant.
// - If you need more evidence (logs, docs, scans), call the appropriate MCP tool to retrieve it, and summarize the result.
// - Output MUST be JSON with the shape:
// {
//   "categories": ["bug", "security"],
//   "summary": "short overview",
//   "recommendedActions": ["..."],
//   "mcpOutputs": [
//      {"provider": "kodusmcp", "toolName": "KODUS_GET_LOGS", "output": "result text"}
//   ]
// }

// File metadata:
// - filename: ${file.filename}
// - status: ${file.status}
// - additions: ${file.additions}
// - deletions: ${file.deletions}
// - total_lines_in_patch: ${linesChanged}

// Diff snippet (truncated):
// ${diffSnippet ?? file.patchWithLinesStr ?? 'N/A'}
// `;
//     }

//     private parseAgentResponse(
//         response: unknown,
//     ): FileContextAgentResult | null {
//         if (!response) {
//             return null;
//         }

//         const text =
//             typeof response === 'string'
//                 ? response
//                 : JSON.stringify(response, null, 2);

//         try {
//             const jsonMatch =
//                 text.match(/```json\s*([\s\S]*?)```/) ||
//                 text.match(/```\s*([\s\S]*?)```/);
//             const payload = jsonMatch ? jsonMatch[1] : text;
//             const parsed = JSON.parse(payload.trim());
//             return {
//                 categories: Array.isArray(parsed.categories)
//                     ? parsed.categories
//                     : [],
//                 summary:
//                     typeof parsed.summary === 'string'
//                         ? parsed.summary
//                         : undefined,
//                 recommendedActions: Array.isArray(parsed.recommendedActions)
//                     ? parsed.recommendedActions
//                     : undefined,
//                 mcpOutputs: Array.isArray(parsed.mcpOutputs)
//                     ? parsed.mcpOutputs
//                     : undefined,
//                 rawResponse: text,
//             };
//         } catch (error) {
//             this.logger.warn({
//                 message: 'Failed to parse FileContextAgent response as JSON',
//                 context: FileContextAgentProvider.name,
//                 error,
//                 metadata: {
//                     preview: text.substring(0, 500),
//                 },
//             });

//             return {
//                 categories: [],
//                 summary: undefined,
//                 recommendedActions: undefined,
//                 rawResponse: text,
//             };
//         }
//     }

//     async executeForFile(params: {
//         organizationAndTeamData: OrganizationAndTeamData;
//         file: FileChange;
//         diffSnippet?: string;
//     }): Promise<FileContextAgentResult | null> {
//         const { organizationAndTeamData, file, diffSnippet } = params;

//         if (!organizationAndTeamData) {
//             throw new Error(
//                 'Organization and team data is required for FileContextAgent',
//             );
//         }

//         await this.fetchBYOKConfig(organizationAndTeamData);
//         await this.initialize(organizationAndTeamData);

//         if (!this.orchestration) {
//             throw new Error('FileContextAgent orchestration not ready');
//         }

//         const thread = createThreadId(
//             {
//                 organizationId: organizationAndTeamData.organizationId,
//                 file: file.filename,
//             },
//             { prefix: 'fca' },
//         );

//         const prompt = this.buildPrompt(file, diffSnippet);

//         const result = await this.orchestration.callAgent(
//             'kodus-file-context-agent',
//             prompt,
//             {
//                 thread,
//                 userContext: {
//                     organizationAndTeamData,
//                     fileName: file.filename,
//                 },
//             },
//         );

//         return this.parseAgentResponse(result.result);
//     }
// }
