import { randomUUID } from 'node:crypto';
import ivm from 'isolated-vm';
import util from 'node:util';

import type {
    ContextEvidence,
    SandboxExecutionLog,
    SandboxExecutionRequest,
    SandboxExecutionResult,
    SandboxExecutionStats,
    SandboxRuntime,
} from '../interfaces.js';

export interface IsolatedVMRuntimeOptions {
    defaultTimeoutMs?: number;
    memoryLimitMb?: number;
    inspector?: boolean;
    globals?: Record<string, unknown>;
    onEvidence?: (e: ContextEvidence) => Promise<void> | void;
}

export class IsolatedVMRuntime implements SandboxRuntime {
    private readonly defaultTimeout: number;
    private readonly memoryLimit: number;
    private readonly inspector: boolean;
    private readonly baseGlobals: Record<string, unknown>;
    private readonly evidenceHook?: (
        e: ContextEvidence,
    ) => Promise<void> | void;

    constructor(options: IsolatedVMRuntimeOptions = {}) {
        this.defaultTimeout = Math.max(0, options.defaultTimeoutMs ?? 5000);
        this.memoryLimit = Math.max(8, options.memoryLimitMb ?? 128);
        this.inspector = options.inspector ?? false;
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

        const isolate = new ivm.Isolate({
            memoryLimit: this.memoryLimit,
            inspector: this.inspector,
        });

        const context = await isolate.createContext();
        const jail = context.global;

        await jail.set('global', jail.derefInto());
        await jail.set('console', this.createConsole(logs), {
            reference: true,
        });

        await context.evalClosure(
            `globalThis.__sandbox = {
                input: arguments[0],
                files: arguments[1],
            };`,
            [request.input ?? {}, request.files ?? {}],
            { arguments: { copy: true } },
        );

        for (const [key, value] of Object.entries(this.baseGlobals)) {
            await jail.set(key, new ivm.ExternalCopy(value).copyInto());
        }

        await this.bindHelper(context, 'publishEvidence', (raw: unknown) => {
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
        });

        if (request.helpers) {
            for (const [name, helper] of Object.entries(request.helpers)) {
                if (typeof helper === 'function') {
                    await this.bindHelper(
                        context,
                        name,
                        helper as (...args: unknown[]) => unknown,
                    );
                } else {
                    await context.evalClosure(
                        'globalThis.__sandbox[arguments[0]] = arguments[1];',
                        [name, helper],
                        { arguments: { copy: true } },
                    );
                }
            }
        }

        const source = this.wrapCode(request.code, request.entryPoint);
        const script = await isolate.compileScript(source, {
            filename:
                (request.metadata?.filename as string | undefined) ??
                `sandbox-${executionId}.js`,
        });

        let success = false;
        let output: TOutput | undefined;
        let error:
            | {
                  message: string;
                  stack?: string;
                  code?: string;
              }
            | undefined;

        try {
            const result = await script.run(context, {
                timeout: request.timeoutMs ?? this.defaultTimeout,
            });
            if (result instanceof ivm.Reference) {
                output = (await result.copy()) as TOutput;
            } else if (result && typeof result.copy === 'function') {
                output = (await result.copy()) as TOutput;
            } else {
                output = result as TOutput;
            }
            success = true;
        } catch (err) {
            success = false;
            error = this.transformError(err);
        } finally {
            script.release();
            isolate.dispose();
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
            return `(async () => {
${trimmed}
})()`;
        }

        return `(async () => {
${trimmed}

const entry = typeof ${entryPoint} === 'function'
    ? ${entryPoint}
    : globalThis['${entryPoint}'];

if (typeof entry !== 'function') {
    throw new Error('Sandbox entryPoint "${entryPoint}" is not a function');
}

return await entry(globalThis.__sandbox);
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    private createConsole(logs: SandboxExecutionLog[]): ivm.Reference<Console> {
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

        return new ivm.Reference(bridge);
    }

    private async bindHelper(
        context: ivm.Context,
        name: string,
        fn: (...args: unknown[]) => unknown,
    ): Promise<void> {
        const ref = new ivm.Reference(fn);
        await context.evalClosure(
            `const helperName = arguments[0];
const helperRef = arguments[1];
globalThis.__sandbox[helperName] = function(...innerArgs) {
    return helperRef.applySyncPromise(undefined, innerArgs, {
        arguments: { copy: true },
        result: { promise: true },
    });
};`,
            [name, ref],
            { arguments: { reference: true } },
        );
    }
}
