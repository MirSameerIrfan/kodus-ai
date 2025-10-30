import type { MCPRegistration, MCPStatus, MCPToolReference } from '../interfaces.js';

export interface MCPRegistry {
    register(registration: MCPRegistration): void;
    update(id: string, patch: Partial<MCPRegistration>): void;
    unregister(id: string): void;
    get(id: string): MCPRegistration | undefined;
    list(): MCPRegistration[];
    resolveTool(
        mcpId: string,
        toolName: string,
    ): { registration: MCPRegistration; tool: MCPToolReference } | undefined;
    markHeartbeat(id: string, status?: MCPStatus): void;
}

export class InMemoryMCPRegistry implements MCPRegistry {
    private readonly registrations = new Map<string, MCPRegistration>();

    register(registration: MCPRegistration): void {
        this.registrations.set(registration.id, {
            ...registration,
            tools: registration.tools ?? [],
        });
    }

    update(id: string, patch: Partial<MCPRegistration>): void {
        const existing = this.registrations.get(id);
        if (!existing) {
            throw new Error(`MCP registration ${id} not found`);
        }

        this.registrations.set(id, {
            ...existing,
            ...patch,
            tools: patch.tools ?? existing.tools,
        });
    }

    unregister(id: string): void {
        this.registrations.delete(id);
    }

    get(id: string): MCPRegistration | undefined {
        return this.registrations.get(id);
    }

    list(): MCPRegistration[] {
        return Array.from(this.registrations.values());
    }

    resolveTool(
        mcpId: string,
        toolName: string,
    ):
        | { registration: MCPRegistration; tool: MCPToolReference }
        | undefined {
        const registration = this.registrations.get(mcpId);
        if (!registration) {
            return undefined;
        }

        const tool = registration.tools.find(
            (candidate) => candidate.toolName === toolName,
        );

        if (!tool) {
            return undefined;
        }

        return { registration, tool };
    }

    markHeartbeat(id: string, status?: MCPStatus): void {
        const existing = this.registrations.get(id);
        if (!existing) {
            return;
        }

        existing.lastHeartbeatAt = Date.now();
        if (status) {
            existing.status = status;
        }

        this.registrations.set(id, existing);
    }
}
