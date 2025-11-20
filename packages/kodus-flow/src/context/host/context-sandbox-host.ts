import type {
    MCPAdapter,
    MCPToolRawWithServer,
} from '../../core/types/allTypes.js';
import { InMemoryEvidenceBus } from '../core/evidence/in-memory-evidence-bus.js';
import type {
    EvidenceBus,
    MCPClient,
    MCPInvocationRequest,
    MCPInvocationResult,
    MCPRegistration,
    MCPToolReference,
    SandboxExecutionResult,
    SandboxRuntime,
    ToolSchema,
} from '../core/interfaces.js';
import { InMemoryMCPRegistry, type MCPRegistry } from '../core/mcp/registry.js';
import { MCPRuntimeClient } from '../core/mcp/runtime-client.js';
import { IsolatedVMRuntime } from '../core/sandbox/isolated-vm-runtime.js';
import type { IsolatedVMRuntimeOptions } from '../core/sandbox/isolated-vm-runtime.js';
import type { VirtualEntry } from '../core/mcp/virtual-file-system.js';
import type { MCPRegistry as FlowMCPRegistry } from '../../adapters/mcp/registry.js';

interface SandboxScriptRequest {
    id?: string;
    code: string;
    entryPoint?: string;
    input?: Record<string, unknown>;
    files?: Record<string, string>;
    metadata?: Record<string, unknown>;
    timeoutMs?: number;
}

interface ContextSandboxHostOptions {
    mcpAdapter: MCPAdapter;
    evidenceBus?: EvidenceBus;
    runtime?: SandboxRuntime;
    runtimeOptions?: IsolatedVMRuntimeOptions;
}

class FlowMCPClientAdapter implements MCPClient {
    constructor(private readonly registry: FlowMCPRegistry) {}

    async invoke(request: MCPInvocationRequest): Promise<MCPInvocationResult> {
        return this.invokeTool(request);
    }

    async invokeTool(
        request: MCPInvocationRequest,
    ): Promise<MCPInvocationResult> {
        const startedAt = Date.now();
        try {
            const output = await this.registry.executeTool(
                request.tool.toolName,
                request.input,
                request.registry.id,
            );
            return {
                success: true,
                output: output as Record<string, unknown>,
                latencyMs: Date.now() - startedAt,
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                latencyMs: Date.now() - startedAt,
            };
        }
    }
}

export class ContextSandboxHost {
    private readonly evidenceBus: EvidenceBus;
    private readonly runtime: SandboxRuntime;
    private contextRegistry: MCPRegistry = new InMemoryMCPRegistry();
    private vfs: VirtualEntry | null = null;
    private registryReady = false;

    constructor(private readonly options: ContextSandboxHostOptions) {
        this.evidenceBus = options.evidenceBus ?? new InMemoryEvidenceBus();
        this.runtime =
            options.runtime ??
            new IsolatedVMRuntime({
                ...(options.runtimeOptions ?? {}),
                onEvidence: async (evidence) => {
                    await this.evidenceBus.publish(evidence);
                },
            });
    }

    async refresh(): Promise<void> {
        await this.rebuildContextRegistry();
    }

    async listFiles(path = ''): Promise<VirtualEntry[]> {
        await this.ensureVirtualFileSystem();
        if (!this.vfs) {
            return [];
        }
        const node = this.resolveNode(path);
        return node?.children ?? [];
    }

    async readFile(path: string): Promise<string | undefined> {
        await this.ensureVirtualFileSystem();
        const node = this.resolveNode(path);
        if (!node || node.type !== 'file') {
            return undefined;
        }
        return node.content;
    }

    async runScript(
        request: SandboxScriptRequest,
    ): Promise<SandboxExecutionResult<unknown>> {
        await this.ensureContextRegistry();
        const flowRegistry = this.options.mcpAdapter.getRegistry();
        const contextClient = new FlowMCPClientAdapter(flowRegistry);
        const runtimeClient = new MCPRuntimeClient(
            contextClient,
            this.contextRegistry,
        );

        return this.runtime.run({
            id: request.id,
            code: request.code,
            entryPoint: request.entryPoint,
            input: request.input,
            files: request.files,
            timeoutMs: request.timeoutMs,
            metadata: request.metadata,
            helpers: {
                callMCPTool: (payload: {
                    mcpId: string;
                    toolName: string;
                    input: Record<string, unknown>;
                }) => runtimeClient.callTool(payload),
            },
        });
    }

    getEvidenceBus(): EvidenceBus {
        return this.evidenceBus;
    }

    private async rebuildContextRegistry(): Promise<void> {
        await this.options.mcpAdapter.ensureConnection();
        const registry = this.options.mcpAdapter.getRegistry();
        const tools = await registry.listAllTools();

        const grouped = new Map<string, MCPRegistration>();

        for (const tool of tools as MCPToolRawWithServer[]) {
            const serverId = tool.serverName ?? 'default';
            if (!grouped.has(serverId)) {
                grouped.set(serverId, {
                    id: serverId,
                    endpoint: serverId,
                    status: 'available',
                    tools: [],
                    metadata: { serverName: serverId },
                });
            }

            const registration = grouped.get(serverId)!;
            const toolRef: MCPToolReference = {
                mcpId: serverId,
                toolName: tool.name,
                description: tool.description,
                schema: tool.inputSchema as ToolSchema | undefined,
            };
            registration.tools?.push(toolRef);
        }

        this.contextRegistry = new InMemoryMCPRegistry();
        for (const registration of grouped.values()) {
            this.contextRegistry.register(registration);
        }
        this.vfs = null;
        this.registryReady = true;
    }

    private async ensureContextRegistry(): Promise<void> {
        if (!this.registryReady) {
            await this.rebuildContextRegistry();
        }
    }

    private async ensureVirtualFileSystem(): Promise<void> {
        if (!this.vfs) {
            await this.ensureContextRegistry();
            this.vfs = (
                await this.contextRegistry.buildVirtualFileSystem()
            ).toTree();
        }
    }

    private resolveNode(path: string): VirtualEntry | null {
        if (!this.vfs) {
            return null;
        }
        if (!path) {
            return this.vfs;
        }
        const segments = path
            .split('/')
            .map((segment) => segment.trim())
            .filter(Boolean);
        let current: VirtualEntry | undefined = this.vfs;
        for (const segment of segments) {
            if (!current?.children) {
                return null;
            }
            current = current.children.find((child) => child.name === segment);
        }
        return current ?? null;
    }
}
