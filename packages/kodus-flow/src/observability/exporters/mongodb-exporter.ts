import {
    TraceItem,
    LogProcessor,
    ObservabilityExporter,
    TraceItem as TraceItemType,
    LogContext,
    AGENT,
    TOOL,
} from '../types.js';
import { createLogger } from '../logger.js';
import {
    LogLevel,
    MongoDBExporterConfig,
    MongoDBLogItem,
    MongoDBTelemetryItem,
    ObservabilityStorageConfig,
} from '../../core/types/allTypes.js';

export class MongoDBExporter implements LogProcessor, ObservabilityExporter {
    public readonly name = 'MongoDBExporter';
    private config: MongoDBExporterConfig;
    private logger: ReturnType<typeof createLogger>;

    private client: any = null;

    private db: any = null;
    private collections: {
        logs: any;
        telemetry: any;
    } | null = null;

    // Buffers para batch processing
    private logBuffer: MongoDBLogItem[] = [];
    private telemetryBuffer: MongoDBTelemetryItem[] = [];
    private readonly maxBufferSize = 5000; // Cap buffer size to prevent memory leaks

    // Flush timers
    private logFlushTimer: NodeJS.Timeout | null = null;
    private telemetryFlushTimer: NodeJS.Timeout | null = null;

    private isFlushingLogs = false;
    private isFlushingTelemetry = false;

    private isInitialized = false;

    constructor(config: Partial<MongoDBExporterConfig> = {}) {
        this.config = {
            connectionString: 'mongodb://localhost:27017/kodus',
            database: 'kodus',
            collections: {
                logs: 'observability_logs',
                telemetry: 'observability_telemetry',
            },
            batchSize: 50,
            flushIntervalMs: 15000,
            maxRetries: 3,
            ttlDays: 30,
            enableObservability: true,
            ...config,
        };

        this.logger = createLogger('mongodb-exporter');
    }

    // --- ObservabilityExporter Implementation ---

    async exportTrace(item: TraceItemType): Promise<void> {
        this.exportTelemetry(item);
    }

    async shutdown(): Promise<void> {
        return this.dispose();
    }

    // --- End ObservabilityExporter Implementation ---

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            const { MongoClient: mongoClient } = await import('mongodb');

            this.client = new mongoClient(this.config.connectionString, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 10000,
                socketTimeoutMS: 45000,
            });

            await this.client.connect();
            this.db = this.client.db(this.config.database);

            // Inicializar collections
            this.collections = {
                logs: this.db.collection(this.config.collections.logs),
                telemetry: this.db.collection(
                    this.config.collections.telemetry,
                ),
            };

            // Criar índices para performance
            await this.createIndexes();

            // Configurar TTL para limpeza automática
            await this.setupTTL();

            // Iniciar timers de flush
            this.startFlushTimers();

            this.isInitialized = true;

            this.logger.log({
                message: 'MongoDB Exporter initialized',
                context: this.constructor.name,
                metadata: {
                    database: this.config.database,
                    collections: this.config.collections,
                    batchSize: this.config.batchSize,
                    flushIntervalMs: this.config.flushIntervalMs,
                },
            });
        } catch (error) {
            this.logger.error({
                message: 'Failed to initialize MongoDB Exporter',
                context: this.constructor.name,
                error: error as Error,
            });
            throw error;
        }
    }

    /**
     * Criar índices para performance
     */
    private async createIndexes(): Promise<void> {
        if (!this.collections) return;

        try {
            // Logs indexes
            await this.collections.logs.createIndex({ timestamp: 1 });
            await this.collections.logs.createIndex({ correlationId: 1 });
            await this.collections.logs.createIndex({ tenantId: 1 });
            await this.collections.logs.createIndex({ level: 1 });
            await this.collections.logs.createIndex({ component: 1 });

            // Telemetry indexes
            await this.collections.telemetry.createIndex({ timestamp: 1 });
            await this.collections.telemetry.createIndex({ correlationId: 1 });
            await this.collections.telemetry.createIndex({ tenantId: 1 });
            await this.collections.telemetry.createIndex({ name: 1 });
            await this.collections.telemetry.createIndex({ agentName: 1 });
            await this.collections.telemetry.createIndex({ toolName: 1 });
            await this.collections.telemetry.createIndex({ phase: 1 });

            this.logger.log({
                message: 'Performance indexes created successfully',
                context: this.constructor.name,
            });
        } catch (error) {
            this.logger.warn({
                message:
                    'Failed to create performance indexes, continuing without indexes',
                context: this.constructor.name,
                error: error as Error,
            });
        }
    }

    /**
     * Configurar TTL para limpeza automática
     */
    private async setupTTL(): Promise<void> {
        if (!this.collections) return;

        if (!this.config.ttlDays || this.config.ttlDays <= 0) {
            this.logger.log({
                message: 'TTL not configured, skipping TTL setup',
                context: this.constructor.name,
            });
            return;
        }

        const ttlSeconds = this.config.ttlDays * 24 * 60 * 60;

        try {
            const collections = [
                { name: 'logs', collection: this.collections.logs },
                { name: 'telemetry', collection: this.collections.telemetry },
            ];

            for (const { name, collection } of collections) {
                try {
                    const existingIndexes = await collection
                        .listIndexes()
                        .toArray();
                    const ttlIndexExists = existingIndexes.some(
                        (index: any) =>
                            index.key.createdAt === 1 &&
                            index.expireAfterSeconds,
                    );

                    if (!ttlIndexExists) {
                        try {
                            await collection.dropIndex('createdAt_1');
                            this.logger.log({
                                message: `Dropped existing createdAt index without TTL for ${name}`,
                                context: this.constructor.name,
                            });
                        } catch {
                            this.logger.debug({
                                message: `Could not drop existing createdAt index for ${name}, continuing`,
                                context: this.constructor.name,
                            });
                        }

                        await collection.createIndex(
                            { createdAt: 1 },
                            {
                                expireAfterSeconds: ttlSeconds,
                                background: true,
                            },
                        );
                        this.logger.log({
                            message: `Created TTL index for ${name} collection`,
                            context: this.constructor.name,
                        });
                    } else {
                        this.logger.debug({
                            message: `TTL index already exists for ${name} collection`,
                            context: this.constructor.name,
                        });
                    }
                } catch (collectionError) {
                    this.logger.warn({
                        message: `Failed to setup TTL for ${name} collection`,
                        context: this.constructor.name,
                        error: collectionError as Error,
                    });
                }
            }
        } catch (error) {
            this.logger.warn({
                message: 'Failed to create TTL indexes, continuing without TTL',
                context: this.constructor.name,
                error: error as Error,
                metadata: {
                    ttlDays: this.config.ttlDays,
                },
            });
        }
    }

    /**
     * Iniciar timers de flush
     */
    private startFlushTimers(): void {
        this.logFlushTimer = setInterval(
            () => this.flushLogs(),
            this.config.flushIntervalMs,
        );

        this.telemetryFlushTimer = setInterval(
            () => this.flushTelemetry(),
            this.config.flushIntervalMs,
        );
    }

    /**
     * Exportar log
     */
    async exportLog(
        level: LogLevel,
        message: string,
        context?: LogContext | string,
        error?: Error,
        legacyError?: Error,
    ): Promise<void> {
        let component = 'unknown';
        let metadata: LogContext | undefined;
        const actualError = error || legacyError;

        if (typeof context === 'string') {
            component = context;
            metadata = undefined;
        } else if (typeof context === 'object') {
            component = String(context?.component || 'unknown');
            metadata = context;
        }

        this._pushLog(level, message, component, metadata, actualError);
    }

    private _pushLog(
        level: LogLevel,
        message: string,
        component: string,
        context?: LogContext,
        error?: Error,
    ) {
        // MongoDB saves all logs for complete history/audit trail
        // Console logging respects API_LOG_LEVEL via Pino
        // Prevent buffer overflow
        if (this.logBuffer.length >= this.maxBufferSize) {
            // Drop oldest logs to make space for new ones
            const droppedCount = this.logBuffer.length - this.maxBufferSize + 1;
            this.logBuffer.splice(0, droppedCount);
            // Optionally log internally that we dropped logs, but be careful not to loop
        }

        const logItem: MongoDBLogItem = {
            timestamp: new Date(),
            level,
            message,
            component,
            correlationId: context?.correlationId as string | undefined,
            tenantId: context?.tenantId as string | undefined,
            executionId: context?.executionId as string | undefined,
            sessionId: context?.sessionId as string | undefined,
            metadata: context,
            error: error
                ? {
                      name: error.name,
                      message: error.message,
                      stack: error.stack,
                  }
                : undefined,
            createdAt: new Date(),
        };

        this.logBuffer.push(logItem);

        if (this.logBuffer.length >= this.config.batchSize) {
            void this.flushLogs();
        }
    }

    process(
        level: LogLevel,
        message: string,
        context?: LogContext,
        error?: Error,
    ): void {
        void this.exportLog(level, message, context, error);
    }

    exportTelemetry(item: TraceItem): void {
        const duration = item.endTime - item.startTime;
        const correlationId =
            (item.attributes[AGENT.CORRELATION_ID] as string) ||
            (item.attributes[TOOL.CORRELATION_ID] as string) ||
            (item.attributes['correlationId'] as string);
        const tenantId =
            (item.attributes[AGENT.TENANT_ID] as string) ||
            (item.attributes['tenantId'] as string) ||
            (item.attributes['tenant.id'] as string);
        const executionId =
            (item.attributes[AGENT.EXECUTION_ID] as string) ||
            (item.attributes[TOOL.EXECUTION_ID] as string) ||
            (item.attributes['execution.id'] as string);
        const sessionId =
            (item.attributes[AGENT.CONVERSATION_ID] as string) ||
            (item.attributes['sessionId'] as string) ||
            (item.attributes['conversation.id'] as string);
        const agentName = item.attributes[AGENT.NAME] as string;
        const toolName = item.attributes[TOOL.NAME] as string;
        const phase = item.attributes['agent.phase'] as
            | 'think'
            | 'act'
            | 'observe';

        const telemetryItem: MongoDBTelemetryItem = {
            timestamp: new Date(item.startTime),
            name: item.name,
            duration,
            correlationId,
            tenantId,
            executionId,
            sessionId,
            agentName,
            toolName,
            phase,
            attributes: item.attributes,
            status: item.status.code as any,
            error: item.status.message
                ? {
                      name: 'Error',
                      message: item.status.message,
                  }
                : undefined,
            createdAt: new Date(),
        };

        this.telemetryBuffer.push(telemetryItem);

        // Prevent buffer overflow
        if (this.telemetryBuffer.length >= this.maxBufferSize) {
            const droppedCount =
                this.telemetryBuffer.length - this.maxBufferSize + 1;
            this.telemetryBuffer.splice(0, droppedCount);
        }

        if (this.telemetryBuffer.length >= this.config.batchSize) {
            void this.flushTelemetry();
        }
    }

    async exportError(error: Error, context?: LogContext): Promise<void> {
        const logContext = {
            ...context,
            component: 'error-handler',
        };
        await this.exportLog('error', error.message, logContext, error);
    }

    /**
     * Flush logs para MongoDB
     */
    private async flushLogs(): Promise<void> {
        if (
            !this.collections ||
            this.logBuffer.length === 0 ||
            this.isFlushingLogs
        )
            return;

        this.isFlushingLogs = true;
        const logsToFlush = [...this.logBuffer];
        this.logBuffer = [];

        try {
            await this.collections.logs.insertMany(logsToFlush);
            // Removed debug log to avoid recursive logging and pollution
        } catch (error) {
            this.logger.error({
                message: 'Failed to flush logs to MongoDB',
                context: this.constructor.name,
                error: error as Error,
            });

            // Put logs back (LIFO to preserve order roughly, or just push back)
            // But respect max buffer size
            const availableSpace = this.maxBufferSize - this.logBuffer.length;
            if (availableSpace > 0) {
                // Keep the most recent ones if we have to drop
                const toKeep = logsToFlush.slice(
                    Math.max(0, logsToFlush.length - availableSpace),
                );
                this.logBuffer.unshift(...toKeep);
            }

            // Exponential Backoff logic could be applied by pausing the timer, but here we just rely on interval.
            // A more sophisticated approach would be to dynamically adjust flushIntervalMs, but simplest is just logging and retrying next tick.
        } finally {
            this.isFlushingLogs = false;
        }
    }

    /**
     * Flush telemetry para MongoDB
     */
    private async flushTelemetry(): Promise<void> {
        if (
            !this.collections ||
            this.telemetryBuffer.length === 0 ||
            this.isFlushingTelemetry
        )
            return;

        this.isFlushingTelemetry = true;
        const telemetryToFlush = [...this.telemetryBuffer];
        this.telemetryBuffer = [];

        try {
            await this.collections.telemetry.insertMany(telemetryToFlush);
            // Removed debug log to avoid recursive logging and pollution
        } catch (error) {
            this.logger.error({
                message: 'Failed to flush telemetry to MongoDB',
                context: this.constructor.name,
                error: error as Error,
            });

            const availableSpace =
                this.maxBufferSize - this.telemetryBuffer.length;
            if (availableSpace > 0) {
                const toKeep = telemetryToFlush.slice(
                    Math.max(0, telemetryToFlush.length - availableSpace),
                );
                this.telemetryBuffer.unshift(...toKeep);
            }
        } finally {
            this.isFlushingTelemetry = false;
        }
    }

    /**
     * Flush todos os buffers
     */
    async flush(): Promise<void> {
        await Promise.allSettled([this.flushLogs(), this.flushTelemetry()]);
    }

    /**
     * Dispose do exporter
     */
    async dispose(): Promise<void> {
        if (this.logFlushTimer) clearInterval(this.logFlushTimer);
        if (this.telemetryFlushTimer) clearInterval(this.telemetryFlushTimer);

        await this.flush();

        if (this.client) {
            await this.client.close();
        }

        this.isInitialized = false;
        this.logger.log({
            message: 'MongoDB Exporter disposed',
            context: this.constructor.name,
        });
    }
}

export function createMongoDBExporterFromStorage(
    storageConfig: ObservabilityStorageConfig,
): MongoDBExporter {
    const config: Partial<MongoDBExporterConfig> = {
        connectionString: storageConfig.connectionString,
        database: storageConfig.database,
        collections: {
            logs: storageConfig.collections?.logs || 'observability_logs',
            telemetry:
                storageConfig.collections?.telemetry ||
                'observability_telemetry',
        },
        batchSize: storageConfig.batchSize || 100,
        flushIntervalMs: storageConfig.flushIntervalMs || 5000,
        maxRetries: 3,
        ttlDays: storageConfig.ttlDays ?? 30,
        enableObservability: storageConfig.enableObservability ?? true,
    };

    return new MongoDBExporter(config);
}

export function createMongoDBExporter(
    config?: Partial<MongoDBExporterConfig>,
): MongoDBExporter {
    return new MongoDBExporter(config);
}
