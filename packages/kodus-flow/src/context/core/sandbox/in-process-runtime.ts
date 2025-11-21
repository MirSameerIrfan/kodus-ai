import { randomUUID } from 'node:crypto';
import { createContext, Script } from 'node:vm';
import util from 'node:util';

import type {
    ContextEvidence,
    SandboxExecutionLog,
    SandboxExecutionRequest,
    SandboxExecutionResult,
    SandboxExecutionStats,
    SandboxRuntime,
} from '../interfaces.js';

export interface InProcessRuntimeOptions {
    defaultTimeoutMs?: number;
    globals?: Record<string, unknown>;
    onEvidence?: (e: ContextEvidence) => Promise<void> | void;
}

export class InProcessRuntime implements SandboxRuntime {
    private readonly defaultTimeout: number;
    private readonly baseGlobals: Record<string, unknown>;
    private readonly evidenceHook?: (
        e: ContextEvidence,
    ) => Promise<void> | void;

    constructor(options: InProcessRuntimeOptions = {}) {
        this.defaultTimeout = Math.max(0, options.defaultTimeoutMs ?? 5000);
        this.baseGlobals = {
            ...(options.globals ?? {}),
        };
        this.evidenceHook = options.onEvidence;
    }

    async run<TInput = Record<string, unknown>, TOutput = unknown>(
        request: SandboxExecutionRequest<TInput>,
    ): Promise<SandboxExecutionResult<TOutput>> {
        const executionId = request.id ?? randomUUID();
        const logs: SandboxExecutionLog[] = [];
        const evidences: ContextEvidence[] = [];
        const startedAt = Date.now();

        const sandboxGlobals: Record<string, unknown> = {
            console: this.createConsole(logs),
            sandboxContext: {
                input: request.input ?? {},
                files: request.files ?? {},
            },
            ...this.baseGlobals,
        };

        sandboxGlobals.publishEvidence = (raw: unknown) => {
            const evidence = (raw ?? {}) as ContextEvidence;
            const enriched: ContextEvidence = {
                ...evidence,
                id:
                    evidence.id ??
                    `${executionId}::evidence::${evidences.length + 1}`,
                createdAt: evidence.createdAt ?? Date.now(),
            };
            evidences.push(enriched);
            return this.evidenceHook?.(enriched);
        };

        if (request.helpers) {
            for (const [name, helper] of Object.entries(request.helpers)) {
                sandboxGlobals[name] = helper;
            }
        }

        const context = createContext(sandboxGlobals);
        const source = this.wrapCode(request.code, request.entryPoint);

        const script = new Script(source, {
            filename: `sandbox-${executionId}.js`,
        });

        let success = false;
        let output: TOutput | undefined;
        let error:
            | { message: string; stack?: string; code?: string }
            | undefined;

        try {
            output = await script.runInContext(context, {
                timeout: request.timeoutMs ?? this.defaultTimeout,
            });
            success = true;
        } catch (err) {
            success = false;
            error = this.transformError(err);
        }

        const stats: SandboxExecutionStats = {
            startedAt,
            finishedAt: Date.now(),
        };

        return {
            id: executionId,
            success,
            output,
            error,
            logs,
            stats,
            evidences,
        };
    }

    private wrapCode(code: string, entryPoint?: string): string {
        const trimmed = code?.trim() ?? '';

        if (!trimmed) {
            throw new Error('SandboxExecutionRequest.code is empty');
        }

        if (!entryPoint) {
            return `(async () => {\n${trimmed}\n})()`;
        }

        return `(async () => {
${trimmed}

const entry = typeof ${entryPoint} === 'function'
    ? ${entryPoint}
    : globalThis['${entryPoint}'];

if (typeof entry !== 'function') {
    throw new Error('Sandbox entryPoint "${entryPoint}" is not a function');
}

return await entry(globalThis.sandboxContext);
})()`;
    }

    private transformError(err: unknown): {
        message: string;
        stack?: string;
        code?: string;
    } {
        if (!err) {
            return { message: 'Unknown sandbox error' };
        }

        if (err instanceof Error) {
            const anyErr = err as any;
            return {
                message: err.message ?? 'Sandbox execution failed',
                stack: err.stack,
                code:
                    (typeof anyErr.code === 'string' && anyErr.code) ||
                    undefined,
            };
        }

        return {
            message: String(err),
        };
    }

    private createConsole(logs: SandboxExecutionLog[]): Console {
        const bridge = {
            log: (...args: unknown[]) =>
                logs.push({
                    level: 'info',
                    message: util.format(...args),
                    timestamp: Date.now(),
                }),
            info: (...args: unknown[]) =>
                logs.push({
                    level: 'info',
                    message: util.format(...args),
                    timestamp: Date.now(),
                }),
            warn: (...args: unknown[]) =>
                logs.push({
                    level: 'warn',
                    message: util.format(...args),
                    timestamp: Date.now(),
                }),
            error: (...args: unknown[]) =>
                logs.push({
                    level: 'error',
                    message: util.format(...args),
                    timestamp: Date.now(),
                }),
            debug: (...args: unknown[]) =>
                logs.push({
                    level: 'debug',
                    message: util.format(...args),
                    timestamp: Date.now(),
                }),
        } as unknown as Console;

        return bridge;
    }
}
