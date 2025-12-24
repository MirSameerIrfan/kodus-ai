import { getObservability, IdGenerator, StorageEnum } from '@kodus/flow';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectionString } from 'connection-string';

import { DatabaseConnection } from '@libs/core/infrastructure/config/types';

import { createLogger } from '@kodus/flow';
import { TokenTrackingHandler } from '@kodus/kodus-common/llm';

export type TokenUsage = {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    model?: string;
    runId?: string;
    parentRunId?: string;
    output_reasoning_tokens?: number;
    runName?: string;
};

export interface ObservabilityConfig {
    serviceName: string;
    correlationId?: string;
    threadId?: string;
    enableCollections?: boolean;
    customCollections?: {
        logs?: string;
        telemetry?: string;
    };
    customSettings?: {
        batchSize?: number;
        flushIntervalMs?: number;
        ttlDays?: number;
        samplingRate?: number;
        spanTimeoutMs?: number;
    };
}

@Injectable()
export class ObservabilityService {
    private readonly instances = new Map<
        string,
        ReturnType<typeof getObservability>
    >();

    private isInitialized = false;

    private static readonly DEFAULT_COLLECTIONS = {
        logs: 'observability_logs',
        telemetry: 'observability_telemetry',
    };

    private static readonly DEFAULT_SETTINGS = {
        batchSize: 150,
        flushIntervalMs: 5000,
        ttlDays: 0,
        samplingRate: 1,
        spanTimeoutMs: 10 * 60 * 1000,
    };

    private readonly logger = createLogger(ObservabilityService.name);

    constructor(private readonly configService: ConfigService) {}

    /**
     * Initializes the observability engine automatically by fetching configurations from ConfigService.
     * Should be called in each application's main.ts.
     * @param serviceName Origin name to identify logs (e.g., 'api', 'worker')
     */
    async init(serviceName?: string) {
        if (this.isInitialized) {
            return getObservability();
        }

        const mongoConfig =
            this.configService.get<DatabaseConnection>('mongoDatabase');

        const finalName = serviceName
            ? `kodus-${serviceName}`
            : `kodus-${process.env.COMPONENT_TYPE || 'api'}`;

        if (!mongoConfig) {
            this.logger.warn({
                message:
                    'Observability not initialized: mongoDatabase config missing',
                context: ObservabilityService.name,
            });
            return;
        }

        const obs = await this.initializeObservability(mongoConfig, {
            serviceName: finalName,
            enableCollections: true,
        });

        this.isInitialized = true;
        return obs;
    }

    /**
     * Sets the current execution context (correlationId).
     * Used at the beginning of each request or job.
     */
    setContext(correlationId: string, threadId?: string) {
        const obs = getObservability();
        const ctx = obs.createContext(correlationId);

        if (threadId) {
            (ctx as any).sessionId = threadId;
        }

        obs.setContext(ctx);

        this.logger.debug({
            message: 'Execution context set',
            context: ObservabilityService.name,
            metadata: { correlationId, threadId },
        });
    }

    async initializeObservability(
        config: DatabaseConnection,
        options: ObservabilityConfig,
    ) {
        const correlationId =
            options.correlationId || this.generateCorrelationId();
        const key = this.makeKey(config, options.serviceName);

        let obs = this.instances.get(key);

        if (!obs) {
            const obsConfig = this.createObservabilityConfig(config, options);

            obs = getObservability(obsConfig);

            try {
                await obs.initialize();

                this.logger.log({
                    message: 'Observability initialized',
                    context: ObservabilityService.name,
                    metadata: {
                        config,
                        options,
                    },
                });
            } catch (error) {
                console.log('@@@Error initializing observability');
                this.logger.error({
                    message: 'Error initializing observability',
                    context: ObservabilityService.name,
                    error,
                    metadata: {
                        config,
                        options,
                    },
                });
            }

            this.instances.set(key, obs);
        }

        if (correlationId) {
            const ctx = obs.createContext(correlationId);

            if (options.threadId) {
                (ctx as any).sessionId = options.threadId;
            }

            obs.setContext(ctx);
        }

        return obs;
    }

    createAgentObservabilityConfig(
        config: DatabaseConnection,
        serviceName: string,
        correlationId?: string,
    ) {
        return this.createObservabilityConfig(config, {
            serviceName,
            correlationId,
            enableCollections: true,
        });
    }

    createPipelineObservabilityConfig(
        config: DatabaseConnection,
        serviceName: string,
        correlationId?: string,
    ) {
        return this.createObservabilityConfig(config, {
            serviceName,
            correlationId,
            enableCollections: true,
            customSettings: { spanTimeoutMs: 15 * 60 * 1000 },
        });
    }

    /**
     * Starts a span and applies initial attributes.
     */
    startSpan(name: string, attributes?: Record<string, any>) {
        const obs = getObservability();
        const span = obs.startSpan(name);
        if (attributes && typeof span?.setAttributes === 'function') {
            span.setAttributes(attributes);
        }
        return span;
    }

    /**
     * Executes a function within a span.
     */
    async runInSpan<T>(
        name: string,
        fn: (span: any) => Promise<T> | T,
        attributes?: Record<string, any>,
    ): Promise<T> {
        const obs = getObservability();
        const span = this.startSpan(name, {
            ...(attributes ?? {}),
            correlationId: obs.getContext()?.correlationId || '',
        });

        return obs.withSpan(span, async () => {
            try {
                return await fn(span);
            } catch (err: any) {
                span?.setAttributes?.({
                    'error': true,
                    'exception.type': err?.name || 'Error',
                    'exception.message': err?.message || String(err),
                });
                throw err;
            }
        });
    }

    // ---------- Integrated LLM tracking ----------

    createLLMTracking(runName?: string) {
        const tracker = new TokenTrackingHandler();

        const finalize = async ({
            metadata,
            runName: explicitName,
            reset,
        }: {
            metadata?: Record<string, any>;
            runName?: string;
            reset?: boolean;
        } = {}) => {
            const obs = getObservability();
            const span = obs.getCurrentSpan();

            const {
                runKey,
                runName: resolvedName,
                usages,
            } = tracker.consumeCompletedRunUsages(explicitName ?? runName);

            const s = this.summarize(usages);

            if (span) {
                span.setAttributes({
                    'gen_ai.usage.total_tokens': s.totalTokens,
                    'gen_ai.usage.input_tokens': s.inputTokens,
                    'gen_ai.usage.output_tokens': s.outputTokens,
                    ...(s.reasoningTokens > 0 && {
                        'gen_ai.usage.reasoning_tokens': s.reasoningTokens,
                    }),
                    ...(s.modelsArr.length && {
                        'gen_ai.response.model': s.modelsArr.join(','),
                    }),
                    ...(runKey && { 'gen_ai.run.id': runKey }),
                    ...((explicitName ?? runName ?? resolvedName) && {
                        'gen_ai.run.name':
                            explicitName ?? runName ?? resolvedName,
                    }),
                    ...(s.runIdsArr.length && {
                        runIds: s.runIdsArr.join(','),
                    }),
                    ...(s.parentRunIdsArr.length && {
                        parentRunIds: s.parentRunIdsArr.join(','),
                    }),
                    ...(s.runNamesArr.length && {
                        runNames: s.runNamesArr.join(','),
                    }),
                    ...(metadata ?? {}),
                });
            }

            if (reset) {
                tracker.reset(runKey ?? undefined);
            }

            return {
                runKey,
                runName: resolvedName ?? runName,
                usages,
                summary: s,
            };
        };

        return { callbacks: [tracker], tracker, finalize };
    }

    async runLLMInSpan<T>(params: {
        spanName: string;
        runName?: string;
        attrs?: Record<string, any>;
        exec: (callbacks: any[]) => Promise<T>;
    }): Promise<{ result: T; usage: any }> {
        const { spanName, runName, attrs, exec } = params;
        const obs = getObservability();
        const span = obs.startSpan(spanName);

        span?.setAttributes?.({
            ...(attrs ?? {}),
            correlationId: obs.getContext()?.correlationId || '',
        });

        const { callbacks, finalize } = this.createLLMTracking(runName);

        try {
            const result = await obs.withSpan(span, async () =>
                exec(callbacks),
            );
            return {
                result,
                usage: await finalize({ metadata: attrs, reset: true }),
            };
        } catch (err: any) {
            if (typeof span?.setStatus === 'function') {
                span.setStatus({
                    code: 'error',
                    message: err?.message || String(err),
                });
            }
            span?.setAttributes?.({
                'error': true,
                'exception.type': err?.name || 'Error',
                'exception.message': err?.message || String(err),
            });
            throw err;
        } finally {
            span?.end?.();
        }
    }

    // ---------- Helpers privados ----------

    private createObservabilityConfig(
        config: DatabaseConnection,
        options: ObservabilityConfig,
    ) {
        const uri = this.buildConnectionString(config);

        const collections =
            options.enableCollections !== false
                ? {
                      logs:
                          options.customCollections?.logs ??
                          ObservabilityService.DEFAULT_COLLECTIONS.logs,
                      telemetry:
                          options.customCollections?.telemetry ??
                          ObservabilityService.DEFAULT_COLLECTIONS.telemetry,
                  }
                : undefined;

        return {
            logging: { enabled: true },
            mongodb: {
                type: 'mongodb' as const,
                connectionString: uri,
                database: config.database,
                ...(collections && { collections }),
                batchSize:
                    options.customSettings?.batchSize ??
                    ObservabilityService.DEFAULT_SETTINGS.batchSize,
                flushIntervalMs:
                    options.customSettings?.flushIntervalMs ??
                    ObservabilityService.DEFAULT_SETTINGS.flushIntervalMs,
                ttlDays:
                    options.customSettings?.ttlDays ??
                    ObservabilityService.DEFAULT_SETTINGS.ttlDays,
                enableObservability: true,
            },
            telemetry: {
                enabled: true,
                serviceName: options.serviceName,
                sampling: {
                    rate:
                        options.customSettings?.samplingRate ??
                        ObservabilityService.DEFAULT_SETTINGS.samplingRate,
                    strategy: 'probabilistic' as const,
                },
                privacy: { includeSensitiveData: false },
                ...(options.customSettings?.spanTimeoutMs && {
                    spanTimeouts: {
                        enabled: true,
                        maxDurationMs: options.customSettings.spanTimeoutMs,
                    },
                }),
            },
        };
    }

    public buildConnectionString(config: DatabaseConnection): string {
        if (!config?.host) {
            throw new Error(
                'ObservabilityService: invalid or missing host in DatabaseConnection',
            );
        }

        const env = process.env.API_DATABASE_ENV ?? process.env.API_NODE_ENV;

        let uri = new ConnectionString('', {
            user: config.username,
            password: config.password,
            protocol: config.port ? 'mongodb' : 'mongodb+srv',
            hosts: [{ name: config.host, port: config.port }],
        }).toString();

        const shouldAppendClusterConfig =
            !['development', 'test'].includes(env ?? '') &&
            !!process.env.API_MG_DB_PRODUCTION_CONFIG;

        if (shouldAppendClusterConfig) {
            uri = `${uri}/${process.env.API_MG_DB_PRODUCTION_CONFIG}`;
        }

        return uri;
    }

    public getConnectionString(): string {
        const mongoConfig =
            this.configService.get<DatabaseConnection>('mongoDatabase');

        if (!mongoConfig) {
            this.logger.error({
                message:
                    'MongoDB connection string requested but config is missing',
                context: ObservabilityService.name,
            });
            throw new Error('mongoDatabase configuration is not available.');
        }

        return this.buildConnectionString(mongoConfig);
    }

    public getAgentObservabilityConfig(
        serviceName: string,
        correlationId?: string,
    ) {
        const mongoConfig =
            this.configService.get<DatabaseConnection>('mongoDatabase');
        if (!mongoConfig) {
            throw new Error('mongoDatabase configuration is not available.');
        }
        return this.createAgentObservabilityConfig(
            mongoConfig,
            serviceName,
            correlationId,
        );
    }

    public getStorageConfig() {
        const mongoConfig =
            this.configService.get<DatabaseConnection>('mongoDatabase');
        if (!mongoConfig) {
            throw new Error('mongoDatabase configuration is not available.');
        }
        return {
            type: StorageEnum.MONGODB,
            connectionString: this.getConnectionString(),
            database: mongoConfig.database,
        };
    }

    private summarize(usages: TokenUsage[]) {
        const acc = {
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            reasoningTokens: 0,
            models: new Set<string>(),
            runIds: new Set<string>(),
            parentRunIds: new Set<string>(),
            runNames: new Set<string>(),
            details: [] as TokenUsage[],
        };
        for (const u of usages) {
            const input = u.input_tokens ?? 0;
            const output = u.output_tokens ?? 0;
            const reasoning = (u as any).output_reasoning_tokens ?? 0;
            const total = u.total_tokens ?? input + output;
            if (u.model) {
                acc.models.add(u.model);
            }
            if (u.runId) {
                acc.runIds.add(u.runId);
            }
            if (u.parentRunId) {
                acc.parentRunIds.add(u.parentRunId);
            }
            if (u.runName) {
                acc.runNames.add(u.runName);
            }
            acc.totalTokens += total;
            acc.inputTokens += input;
            acc.outputTokens += output;
            acc.reasoningTokens += reasoning;
            acc.details.push(u);
        }
        return {
            ...acc,
            modelsArr: Array.from(acc.models),
            runIdsArr: Array.from(acc.runIds),
            parentRunIdsArr: Array.from(acc.parentRunIds),
            runNamesArr: Array.from(acc.runNames),
        };
    }

    private makeKey(config: DatabaseConnection, serviceName: string): string {
        return JSON.stringify({
            h: config.host,
            p: config.port ?? null,
            db: config.database ?? null,
            s: serviceName,
        });
    }

    generateCorrelationId(): string {
        return IdGenerator.correlationId();
    }

    async ensureContext(
        config: DatabaseConnection,
        serviceName: string,
        correlationId?: string,
    ) {
        await this.initializeObservability(config, {
            serviceName,
            correlationId: correlationId || this.generateCorrelationId(),
        });
    }
}
