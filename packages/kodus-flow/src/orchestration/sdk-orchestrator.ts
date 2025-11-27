import { createLogger } from '../observability/index.js';
import { EngineError } from '../core/errors.js';
import { ToolEngine } from '../engine/tools/tool-engine.js';
import { AgentEngine } from '../engine/agents/agent-engine.js';
import { AgentExecutor } from '../engine/agents/agent-executor.js';
import { IdGenerator } from '../utils/id-generator.js';
import { EnhancedContextBuilder } from '../core/contextNew/index.js';
import { safeJsonSchemaToZod } from '../core/utils/json-schema-to-zod.js';
import {
    AgentConfig,
    AgentCoreConfig,
    AgentData,
    AgentDefinition,
    AgentExecutionOptions,
    agentIdentitySchema,
    defineTool,
    MCPAdapter,
    OrchestrationConfig,
    OrchestrationConfigInternal,
    OrchestrationResult,
    PlannerType,
    SessionId,
    StorageEnum,
    Thread,
    ToolConfig,
    ToolDefinition,
    ToolId,
    UserContext,
} from '../core/types/allTypes.js';
import { getObservability } from '../observability/index.js';
import { AGENT } from '../observability/types.js';
import { SPAN_NAMES } from '../observability/semantic-conventions.js';

export class SDKOrchestrator {
    private agents = new Map<string, AgentData>();
    private toolEngine: ToolEngine;
    private mcpAdapter?: MCPAdapter;
    private logger = createLogger('sdk-orchestrator');
    private config: Required<OrchestrationConfigInternal>;

    constructor(config: OrchestrationConfig) {
        if (config.observability) {
            getObservability(config.observability);
            // Initialize async components like MongoDB exporter
            getObservability()
                .initialize()
                .catch((error) => {
                    this.logger.warn({
                        message:
                            'Failed to initialize observability components',
                        context: this.constructor.name,
                        error: error.message,
                    });
                });
        }

        if (!config.llmAdapter) {
            throw new EngineError(
                'ENGINE_AGENT_INITIALIZATION_FAILED',
                `
🚨 LLM Adapter is REQUIRED!

SDKOrchestrator creates intelligent agents that need LLM to:
- Think and reason about problems
- Make decisions about actions
- Adapt strategies based on observations

Without LLM, you can't create agents - only scripts.
Provide an LLMAdapter to create real agents.

Example:
const orchestrator = new SDKOrchestrator({
    llmAdapter: createLLMAdapter(geminiProvider)
});
            `,
            );
        }

        this.config = {
            llmAdapter: config.llmAdapter,
            tenantId: config.tenantId || 'default-tenant',
            mcpAdapter: config.mcpAdapter || null,
            defaultMaxIterations: config.defaultMaxIterations || 15,
            storage: config.storage || {},
            observability: config.observability || {},
        };

        this.mcpAdapter = config.mcpAdapter;
        this.toolEngine = new ToolEngine();

        this.logger.log({
            message: 'About to configure ContextBuilder with storage config',
            context: this.constructor.name,

            metadata: {
                hasStorageConfig: !!this.config.storage,
                storageKeys: Object.keys(this.config.storage || {}),
            },
        });

        this.configureEnhancedContext();

        this.logger.log({
            message: 'Clean SDKOrchestrator initialized',
            context: this.constructor.name,

            metadata: {
                tenantId: this.config.tenantId,

                llmProvider:
                    this.config.llmAdapter.getProvider?.()?.name || 'unknown',

                hasMCP: !!this.mcpAdapter,
            },
        });
    }

    async createAgent(
        config: AgentConfig,
    ): Promise<AgentDefinition<unknown, unknown, unknown>> {
        this.logger.log({
            message: 'Creating agent',
            context: this.constructor.name,

            metadata: {
                name: config.name,
                planner: config.plannerOptions?.type || PlannerType.REACT,
                executionMode: 'simple',
            },
        });

        try {
            agentIdentitySchema.parse(config.identity);
        } catch (error) {
            throw new EngineError(
                'ENGINE_AGENT_INITIALIZATION_FAILED',
                `Invalid agent identity: ${error instanceof Error ? error.message : 'Unknown validation error'}`,
            );
        }

        const agentDefinition: AgentDefinition<unknown, unknown, unknown> = {
            name: config.name,
            identity: config.identity,
            think: async () => {
                throw new EngineError(
                    'AGENT_ERROR',
                    'Agent think function should be replaced by AgentCore',
                );
            },
            config: {
                name: config.name,
                identity: config.identity,
                enableSession: config.enableSession ?? true,
                enableState: config.enableState ?? true,
                enableMemory: config.enableMemory ?? true,
                maxIterations: config.maxIterations,
                //TODO precisa mesmo
                timeout: config.timeout,
            },
        };

        const agentCoreConfig: AgentCoreConfig = {
            tenantId: this.config.tenantId,
            agentName: config.name,
            llmAdapter: this.config.llmAdapter, // Pass LLM adapter
            llmDefaults: config.llmDefaults,
            maxThinkingIterations:
                config.maxIterations || this.config.defaultMaxIterations,
            enableKernelIntegration: true,
            plannerOptions: config?.plannerOptions || {
                type: PlannerType.REACT,
            },
        };

        let agentInstance:
            | AgentEngine<unknown, unknown, unknown>
            | AgentExecutor<unknown, unknown, unknown>;

        if (config.executionMode === 'workflow') {
            agentInstance = new AgentExecutor(
                agentDefinition,
                this.toolEngine,
                agentCoreConfig,
            );

            this.logger.log({
                message: 'Agent created via AgentExecutor (workflow)',
                context: this.constructor.name,

                metadata: {
                    agentName: config.name,
                    planner: config?.plannerOptions?.type || PlannerType.REACT,
                },
            });
        } else {
            agentInstance = new AgentEngine(
                agentDefinition,
                this.toolEngine,
                agentCoreConfig,
            );

            this.logger.log({
                message: 'Agent created via AgentEngine (simple)',
                context: this.constructor.name,

                metadata: {
                    agentName: config.name,
                    planner: config?.plannerOptions?.type || PlannerType.REACT,
                },
            });
        }

        this.agents.set(config.name, {
            instance: agentInstance,
            definition: agentDefinition,
            config: {
                executionMode: config.executionMode || 'simple',
                hooks: {},
            },
        });

        this.logger.log({
            message: 'Agent registered successfully',
            context: this.constructor.name,

            metadata: {
                agentName: config.name,
                totalAgents: this.agents.size,
            },
        });

        return agentDefinition;
    }

    async callAgent(
        agentName: string,
        input: unknown,
        context?: {
            thread?: Thread;
            userContext?: UserContext;
            sessionId?: SessionId;
        },
    ): Promise<OrchestrationResult<unknown>> {
        const startTime = Date.now();
        const correlationId = IdGenerator.correlationId();
        const obs = getObservability();
        const obsContext = obs.createContext(correlationId);
        obsContext.tenantId = this.config.tenantId;
        obsContext.sessionId = context?.sessionId;
        obsContext.executionId = IdGenerator.executionId();
        obsContext.metadata = {
            agentName,
            threadId: context?.thread?.id,
            operation: 'callAgent',
        };
        obs.setContext(obsContext);

        this.logger.log({
            message: '🚀 SDK ORCHESTRATOR - Agent execution started',
            context: this.constructor.name,

            metadata: {
                agentName,
                correlationId,
                inputType: typeof input,
                hasContext: !!context,
                hasThread: !!context?.thread,
                tenantId: this.config.tenantId,

                trace: {
                    source: 'sdk-orchestrator',
                    step: 'callAgent-start',
                    timestamp: Date.now(),
                },
            },
        });

        // Setup cancellation controller and optional timeout based on agent config
        const ac = new AbortController();
        let timeoutHandle: NodeJS.Timeout | null = null;

        try {
            this.logger.debug({
                message: '🔍 SDK ORCHESTRATOR - Looking up agent',
                context: this.constructor.name,

                metadata: {
                    agentName,
                    correlationId,
                    registeredAgents: Array.from(this.agents.keys()),

                    trace: {
                        source: 'sdk-orchestrator',
                        step: 'agent-lookup',
                        timestamp: Date.now(),
                    },
                },
            });

            const agentData = this.agents.get(agentName);

            if (!agentData) {
                this.logger.error({
                    message: '❌ SDK ORCHESTRATOR - Agent not found',
                    context: this.constructor.name,
                    error: new Error(`Agent '${agentName}' not found`),

                    metadata: {
                        agentName,
                        correlationId,
                        availableAgents: Array.from(this.agents.keys()),
                        trace: {
                            source: 'sdk-orchestrator',
                            step: 'agent-not-found',
                            timestamp: Date.now(),
                        },
                    },
                });
                throw new EngineError(
                    'AGENT_ERROR',
                    `Agent '${agentName}' not found`,
                );
            }

            // Generate thread if not provided
            const thread = context?.thread || {
                id: `thread-${IdGenerator.callId()}`,
                metadata: {
                    description: 'Auto-generated thread',
                    type: 'auto',
                },
            };

            this.logger.log({
                message: '🧵 SDK ORCHESTRATOR - Thread prepared',
                context: this.constructor.name,

                metadata: {
                    agentName,
                    correlationId,
                    threadId: thread.id,
                    threadType: thread.metadata?.type,
                    isAutoGenerated: !context?.thread,

                    trace: {
                        source: 'sdk-orchestrator',
                        step: 'thread-prepared',
                        timestamp: Date.now(),
                    },
                },
            });

            const executionOptions: AgentExecutionOptions = {
                ...context,
                agentName,
                correlationId,
                tenantId: this.config.tenantId,
                signal: ac.signal,
            } as AgentExecutionOptions;

            // Apply agent-level timeout if configured
            const configuredTimeout =
                (agentData.definition?.config?.timeout as number | undefined) ||
                undefined;
            if (configuredTimeout && configuredTimeout > 0) {
                timeoutHandle = setTimeout(() => {
                    ac.abort();
                }, configuredTimeout);
            }

            this.logger.log({
                message: '⚡ SDK ORCHESTRATOR - Starting agent execution',
                context: this.constructor.name,

                metadata: {
                    agentName,
                    correlationId,
                    executionMode: agentData.config.executionMode,
                    isAgentEngine: agentData.instance instanceof AgentEngine,
                    isAgentExecutor:
                        agentData.instance instanceof AgentExecutor,

                    trace: {
                        source: 'sdk-orchestrator',
                        step: 'agent-execution-start',
                        timestamp: Date.now(),
                    },
                },
            });

            const result = await obs.trace(
                SPAN_NAMES.AGENT_EXECUTE,
                async () => {
                    if (agentData.instance instanceof AgentEngine) {
                        this.logger.debug({
                            message:
                                '🔧 SDK ORCHESTRATOR - Executing via AgentEngine',
                            context: this.constructor.name,

                            metadata: {
                                agentName,
                                correlationId,

                                trace: {
                                    source: 'sdk-orchestrator',
                                    step: 'agent-engine-execute',
                                    timestamp: Date.now(),
                                },
                            },
                        });
                        return await agentData.instance.execute(
                            input,
                            executionOptions,
                        );
                    }
                    if (agentData.instance instanceof AgentExecutor) {
                        this.logger.debug({
                            message:
                                '🔧 SDK ORCHESTRATOR - Executing via AgentExecutor (workflow)',
                            context: this.constructor.name,

                            metadata: {
                                agentName,
                                correlationId,

                                trace: {
                                    source: 'sdk-orchestrator',
                                    step: 'agent-executor-execute',
                                    timestamp: Date.now(),
                                },
                            },
                        });
                        return await agentData.instance.executeViaWorkflow(
                            input,
                            executionOptions,
                        );
                    }

                    return Promise.reject(
                        new EngineError(
                            'AGENT_ERROR',
                            `Unknown agent instance type for '${agentName}'`,
                        ),
                    );
                },
                {
                    correlationId,
                    tenantId: this.config.tenantId,
                    attributes: {
                        [AGENT.NAME]: agentName,
                        [AGENT.EXECUTION_ID]: IdGenerator.executionId(),
                        [AGENT.TENANT_ID]: this.config.tenantId,
                        correlationId,
                    },
                },
            );

            if (
                !(agentData.instance instanceof AgentEngine) &&
                !(agentData.instance instanceof AgentExecutor)
            ) {
                this.logger.error({
                    message:
                        '❌ SDK ORCHESTRATOR - Unknown agent instance type',
                    context: this.constructor.name,
                    error: new Error(
                        `Unknown agent instance type for '${agentName}'`,
                    ),

                    metadata: {
                        agentName,
                        correlationId,
                        instanceType: typeof agentData.instance,
                        trace: {
                            source: 'sdk-orchestrator',
                            step: 'unknown-agent-type',
                            timestamp: Date.now(),
                        },
                    },
                });
                throw new EngineError(
                    'AGENT_ERROR',
                    `Unknown agent instance type for '${agentName}'`,
                );
            }

            const duration = Date.now() - startTime;

            this.logger.log({
                message:
                    '✅ SDK ORCHESTRATOR - Agent execution completed successfully',
                context: this.constructor.name,

                metadata: {
                    agentName,
                    correlationId,
                    success: result.success,
                    duration,
                    resultType: typeof result.data,
                    hasData: !!result.data,

                    trace: {
                        source: 'sdk-orchestrator',
                        step: 'agent-execution-success',
                        timestamp: Date.now(),
                    },
                },
            });

            return {
                success: true,
                result: result.data,
                context: {
                    agentName,
                    correlationId,
                    threadId: thread?.id,
                    duration,
                    executionMode: agentData?.config?.executionMode,
                    sessionId: result?.sessionId,
                },
                metadata: {
                    ...result?.metadata,
                },
            };
        } catch (error) {
            const duration = Date.now() - startTime;

            this.logger.error({
                message: '❌ SDK ORCHESTRATOR - Agent execution failed',
                context: this.constructor.name,
                error: error as Error,

                metadata: {
                    agentName,
                    correlationId,
                    duration,
                    errorType:
                        error instanceof Error
                            ? error.constructor.name
                            : typeof error,
                    errorMessage:
                        error instanceof Error ? error.message : String(error),
                    trace: {
                        source: 'sdk-orchestrator',
                        step: 'agent-execution-error',
                        timestamp: Date.now(),
                    },
                },
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                context: {
                    agentName,
                    correlationId,
                    duration,
                },
                metadata: {
                    agentName,
                    correlationId,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                },
            };
        } finally {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            obs.clearContext();
        }
    }

    createTool(config: ToolConfig): ToolDefinition<unknown, unknown> {
        const toolDefinition = defineTool<unknown, unknown>({
            name: config.name,
            description: config.description,
            inputSchema: config.inputSchema,
            outputSchema: config.outputSchema,
            execute: config.execute,
            categories: config.categories || [],
            dependencies: config.dependencies || [],
            tags: [
                ...(config.title ? [`title:${config.title}`] : []),
                ...(config.annotations
                    ? [`annotations:${JSON.stringify(config.annotations)}`]
                    : []),
            ],
        });

        this.toolEngine.registerTool(toolDefinition);

        this.logger.log({
            message: 'Tool created and registered',
            context: this.constructor.name,

            metadata: {
                toolName: config.name,
                description: config.description,
                title: config.title,
                hasAnnotations: !!config.annotations,
            },
        });

        return toolDefinition;
    }

    async callTool(
        toolName: string,
        input: unknown,
        options?: {
            correlationId?: string;
            tenantId?: string;
            signal?: AbortSignal;
        },
    ): Promise<OrchestrationResult<unknown>> {
        const startTime = Date.now();
        const correlationId =
            options?.correlationId || IdGenerator.correlationId();
        const obs = getObservability();
        const obsContext = obs.createContext(correlationId);
        obsContext.tenantId = options?.tenantId || this.config.tenantId;
        obsContext.metadata = { toolName };
        obs.setContext(obsContext);

        this.logger.log({
            message: 'Tool execution started',
            context: this.constructor.name,

            metadata: {
                toolName,
                correlationId,
                tenantId: obsContext.tenantId,
            },
        });

        try {
            const result = await this.toolEngine.executeCall(
                toolName as ToolId,
                input,
                {
                    correlationId,
                    tenantId: obsContext.tenantId,
                    signal: options?.signal,
                },
            );
            const duration = Date.now() - startTime;

            return {
                success: true,
                result,
                context: {
                    toolName,
                    correlationId,
                    duration,
                },
                metadata: {
                    toolName,
                    correlationId,
                },
            };
        } catch (error) {
            const duration = Date.now() - startTime;

            this.logger.error({
                message: 'Tool execution failed',
                context: this.constructor.name,
                error: error as Error,

                metadata: {
                    toolName,
                    correlationId,
                    tenantId: obsContext.tenantId,
                },
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                context: {
                    toolName,
                    correlationId,
                    duration,
                },
                metadata: {
                    toolName,
                    correlationId,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                },
            };
        } finally {
            obs.clearContext();
        }
    }

    getRegisteredTools(): Array<{
        name: string;
        title?: string;
        description: string;
        categories?: string[];
        schema?: unknown;
        outputSchema?: unknown;
        examples?: unknown[];
        plannerHints?: unknown;
        annotations?: Record<string, unknown>;
    }> {
        return this.toolEngine.listTools().map((tool) => {
            const title = tool.tags
                ?.find((tag) => tag.startsWith('title:'))
                ?.replace('title:', '');
            const annotationsTag = tool.tags?.find((tag) =>
                tag.startsWith('annotations:'),
            );
            const annotations = annotationsTag
                ? JSON.parse(annotationsTag.replace('annotations:', ''))
                : undefined;

            return {
                name: tool.name,
                title,
                description: tool.description || `Tool: ${tool.name}`,
                categories: tool.categories,
                schema: tool.inputSchema,
                outputSchema: tool.outputSchema,
                annotations,
            };
        });
    }

    getRegisteredToolsForLLM(): Array<{
        name: string;
        description: string;
        categories?: string[];
        schema?: unknown;
        examples?: unknown[];
        plannerHints?: unknown;
    }> {
        return this.toolEngine.getToolsForLLM().map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        }));
    }

    getToolsForLLM(): Array<{
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    }> {
        return this.toolEngine.getToolsForLLM();
    }

    async registerMCPTools(): Promise<void> {
        if (!this.mcpAdapter) {
            this.logger.warn({
                message: 'MCP adapter not configured - cannot register tools',
                context: this.constructor.name,
            });
            return;
        }

        try {
            const mcpTools = await this.mcpAdapter.getTools();
            this.logger.log({
                message: `Registering ${mcpTools.length} MCP tools`,
                context: this.constructor.name,
            });

            for (const mcpTool of mcpTools) {
                const zodSchema = safeJsonSchemaToZod(mcpTool.inputSchema);
                const output = mcpTool?.outputSchema
                    ? safeJsonSchemaToZod(mcpTool.outputSchema)
                    : undefined;

                this.createTool({
                    name: mcpTool.name,
                    title: mcpTool.title,
                    description:
                        mcpTool.description ||
                        mcpTool.title ||
                        `MCP Tool: ${mcpTool.name}`,
                    inputSchema: zodSchema,
                    outputSchema: output,
                    execute: async (input: unknown) => {
                        const result = await this.mcpAdapter!.executeTool(
                            mcpTool.name,
                            input as Record<string, unknown>,
                        );
                        return { result };
                    },
                    categories: ['mcp'],
                    annotations: mcpTool.annotations,
                });
            }

            this.logger.log({
                message: `Successfully registered ${mcpTools.length} MCP tools`,
                context: this.constructor.name,
            });
        } catch (error) {
            this.logger.error({
                message: 'Failed to register MCP tools',
                context: this.constructor.name,
                error: error as Error,
            });
            throw error;
        }
    }

    getAgentStatus(agentName: string) {
        const agentData = this.agents.get(agentName);
        if (!agentData) {
            return null;
        }

        return {
            name: agentName,
            type: agentData.config.executionMode,
            plannerInfo:
                agentData.instance instanceof AgentEngine
                    ? (
                          agentData.instance as {
                              getPlannerInfo?: () => unknown;
                          }
                      ).getPlannerInfo?.()
                    : { isInitialized: false },
        };
    }

    private configureEnhancedContext(): void {
        try {
            const enhancedConfig = this.getEnhancedContextConfig();
            EnhancedContextBuilder.configure(enhancedConfig);

            this.logger.log({
                message: '✅ EnhancedContextBuilder configured',
                context: this.constructor.name,

                metadata: {
                    mode: enhancedConfig.adapterType,
                    hasConnectionString: !!enhancedConfig.connectionString,
                },
            });
        } catch (error) {
            this.logger.error({
                message: 'Failed to configure EnhancedContextBuilder',
                context: this.constructor.name,
                error:
                    error instanceof Error ? error : new Error('Unknown error'),
            });
            throw error;
        }
    }

    async initializeContextCollections(): Promise<void> {
        try {
            const enhancedConfig = this.getEnhancedContextConfig();

            if (enhancedConfig.adapterType === StorageEnum.MONGODB) {
                this.logger.log({
                    message:
                        '🚀 Initializing ContextNew for MongoDB - creating collections...',
                    context: this.constructor.name,
                    metadata: {
                        mode: enhancedConfig.adapterType,
                        hasConnectionString: !!enhancedConfig.connectionString,
                    },
                });

                const builder = EnhancedContextBuilder.getInstance();
                await builder.initialize();

                this.logger.log({
                    message:
                        '✅ ContextNew initialization complete - MongoDB collections created',
                    context: this.constructor.name,
                });
            } else {
                this.logger.log({
                    message:
                        'ℹ️ Using InMemory storage - no MongoDB collections to create',
                    context: this.constructor.name,
                });
            }
        } catch (error) {
            this.logger.error({
                message: 'Failed to initialize ContextNew collections',
                context: this.constructor.name,
                error:
                    error instanceof Error ? error : new Error('Unknown error'),
            });
            throw error;
        }
    }

    getEnhancedContextConfig() {
        const storage = this.config.storage;

        if (!storage) {
            return {
                adapterType: StorageEnum.INMEMORY,
                connectionString: undefined,
                sessionTTL: 24 * 60 * 60 * 1000,
            };
        }

        const adapterType =
            storage.type === StorageEnum.MONGODB
                ? StorageEnum.MONGODB
                : storage.connectionString
                  ? StorageEnum.MONGODB
                  : StorageEnum.INMEMORY;

        const enhancedConfig = {
            adapterType,
            connectionString: storage.connectionString,
            database: storage.database,
        };

        this.logger.debug({
            message: 'Enhanced context config (SIMPLIFIED)',
            context: this.constructor.name,

            metadata: {
                adapterType,
                hasConnectionString: !!storage.connectionString,
            },
        });

        return enhancedConfig;
    }

    async connectMCP(): Promise<void> {
        if (!this.mcpAdapter) {
            this.logger.warn({
                message: 'MCP adapter not configured, skipping connection',
                context: this.constructor.name,
            });
            return;
        }

        try {
            await this.mcpAdapter.connect();
            this.logger.log({
                message: 'MCP adapter connected successfully',
                context: this.constructor.name,
            });
        } catch (error) {
            this.logger.error({
                message: 'Failed to connect MCP adapter',
                context: this.constructor.name,
                error: error as Error,
            });
            throw error;
        }
    }

    async disconnectMCP(): Promise<void> {
        if (!this.mcpAdapter) {
            return;
        }

        try {
            await this.mcpAdapter.disconnect();
            this.logger.log({
                message: 'MCP adapter disconnected successfully',
                context: this.constructor.name,
            });
        } catch (error) {
            this.logger.error({
                message: 'Failed to disconnect MCP adapter',
                context: this.constructor.name,
                error: error as Error,
            });
        }
    }
}

export async function createOrchestration(
    config: OrchestrationConfig,
): Promise<SDKOrchestrator> {
    const orchestrator = new SDKOrchestrator(config);

    await orchestrator.initializeContextCollections();

    return orchestrator;
}
