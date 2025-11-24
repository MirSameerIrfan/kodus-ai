import type {
    ContextEvidence,
    MCPClient,
    MCPInvocationRequest,
    MCPRegistration,
    SandboxExecutionRequest,
} from '../interfaces.js';
import type { MCPRegistry } from './registry.js';

export interface MCPToolInvocation {
    mcpId: string;
    toolName: string;
    input: Record<string, unknown>;
}

export interface RuntimeClientContext {
    request: SandboxExecutionRequest;
    publishEvidence: (evidence: ContextEvidence) => Promise<void> | void;
}

export interface RuntimeClientHooks {
    onBeforeToolCall?: (payload: MCPToolInvocation) => Promise<void> | void;
    onAfterToolCall?: (
        payload: MCPToolInvocation & {
            output?: Record<string, unknown> | string | null;
        },
    ) => Promise<void> | void;
}

export class MCPRuntimeClient {
    constructor(
        private readonly client: MCPClient,
        private readonly registry: MCPRegistry,
        private readonly hooks: RuntimeClientHooks = {},
    ) {}

    async callTool(
        payload: MCPToolInvocation,
    ): Promise<Record<string, unknown> | string | null> {
        await this.hooks.onBeforeToolCall?.(payload);

        const registration = this.registry.get(payload.mcpId);
        if (!registration) {
            throw new Error(`MCP server ${payload.mcpId} not registered`);
        }

        const tool = registration.tools.find(
            (candidate) => candidate.toolName === payload.toolName,
        );

        if (!tool) {
            throw new Error(
                `Tool ${payload.toolName} not found on MCP server ${payload.mcpId}`,
            );
        }

        const request: MCPInvocationRequest = {
            registry: registration as MCPRegistration,
            tool,
            input: payload.input,
        };

        const invoker =
            this.client.invokeTool?.bind(this.client) ??
            this.client.invoke.bind(this.client);
        const result = await invoker(request);

        await this.hooks.onAfterToolCall?.({
            ...payload,
            output: result.output ?? null,
        });

        if (!result.success) {
            throw new Error(
                `Tool invocation failed: ${payload.mcpId}/${payload.toolName} → ${result.error?.message}`,
            );
        }

        return result.output ?? null;
    }
}

export function createRuntimeHelperModule(params: {
    runtimeClient: MCPRuntimeClient;
    context: RuntimeClientContext;
}) {
    const { runtimeClient, context } = params;

    return {
        callMCPTool: async (payload: MCPToolInvocation) =>
            runtimeClient.callTool(payload),
        publishEvidence: (evidence: ContextEvidence) =>
            context.publishEvidence(evidence),
        getInput: () => context.request.input ?? {},
        getFiles: () => context.request.files ?? {},
    };
}
