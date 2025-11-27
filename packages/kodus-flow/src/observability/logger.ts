import { ExecutionContext } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import * as Sentry from '@sentry/node';
import pino from 'pino';
import { LogArguments, LogLevel, LogProcessor } from './types.js';

/**
 * Simple and robust logger implementation
 */

let pinoLogger: pino.Logger | null = null;
let globalLogProcessors: LogProcessor[] = [];
let spanContextProvider:
    | (() => { traceId: string; spanId: string } | undefined)
    | null = null;
let observabilityContextProvider:
    | (() =>
          | {
                correlationId?: string;
                tenantId?: string;
                sessionId?: string;
            }
          | undefined)
    | null = null;

/**
 * Get or create Pino logger instance
 */
function getPinoLogger(): pino.Logger {
    if (!pinoLogger) {
        // Determine if we should use pretty printing
        const shouldPrettyPrint =
            (process.env.API_LOG_PRETTY || 'false') === 'true';
        const isProduction =
            (process.env.API_NODE_ENV || 'production') === 'production';

        const loggerConfig: pino.LoggerOptions = {
            level: process.env.API_LOG_LEVEL || 'info',
            formatters: {
                level: (label) => ({ level: label }),
                log(object) {
                    if (isProduction && !shouldPrettyPrint) {
                        // Cleaner log for production
                        return {
                            message: object.message,
                            serviceName: object.serviceName,
                            environment: object.environment,
                            error: object.error
                                ? { message: (object?.error as any)?.message }
                                : undefined,
                        };
                    }
                    return object;
                },
            },
            serializers: {
                error: pino.stdSerializers.err,
                err: pino.stdSerializers.err,
                req: pino.stdSerializers.req,
                res: pino.stdSerializers.res,
            },
            redact: {
                paths: [
                    'password',
                    'token',
                    'secret',
                    'apiKey',
                    'authorization',
                    '*.password',
                    '*.token',
                    '*.secret',
                    '*.apiKey',
                    '*.authorization',
                    'req.headers.authorization',
                    'req.headers["x-api-key"]',
                    'user.sensitiveInfo',
                    'metadata.headers.authorization',
                ],
                censor: '[REDACTED]',
            },
            timestamp: pino.stdTimeFunctions.isoTime,
        };

        // Use pretty printing in development
        if (shouldPrettyPrint && !isProduction) {
            pinoLogger = pino(
                {
                    ...loggerConfig,
                    transport: {
                        target: 'pino-pretty',
                        options: {
                            colorize: true,
                            translateTime: 'SYS:standard',
                            ignore: 'pid,hostname',
                            levelFirst: true,
                            errorProps: 'message,stack',
                            messageFormat:
                                '{level} - {serviceName} - {context} - {msg}',
                        },
                    },
                },
                isProduction && !shouldPrettyPrint
                    ? pino.destination({ sync: false, minLength: 4096 })
                    : undefined,
            );
        } else {
            // Production: JSON format with performance optimizations
            pinoLogger = pino(
                {
                    ...loggerConfig,
                    // Performance optimizations for production
                    base: {
                        pid: process.pid,
                        hostname: undefined, // Remove hostname for smaller logs
                    },
                },
                isProduction && !shouldPrettyPrint
                    ? pino.destination({ sync: false, minLength: 4096 })
                    : undefined,
            );
        }
    }
    return pinoLogger;
}

/**
 * Simple logger class with Pino integration
 */
export class SimpleLogger {
    private defaultServiceName: string;

    constructor(serviceName: string) {
        this.defaultServiceName = serviceName;
    }

    public log(args: LogArguments) {
        this.handleLog('info', args);
    }

    public error(args: LogArguments) {
        this.handleLog('error', args);
    }

    public warn(args: LogArguments) {
        this.handleLog('warn', args);
    }

    public debug(args: LogArguments) {
        this.handleLog('debug', args);
    }

    public verbose(args: LogArguments) {
        this.handleLog('verbose', args);
    }

    private handleLog(
        level: LogLevel,
        { message, context, serviceName, error, metadata = {} }: LogArguments,
    ) {
        if (this.shouldSkipLog(context)) {
            return;
        }

        const effectiveServiceName = serviceName || this.defaultServiceName;
        const contextStr = this.extractContextInfo(context);

        const baseLogger = getPinoLogger();

        const childLogger = baseLogger.child({
            serviceName: effectiveServiceName,
            context: contextStr,
        });

        const logObject = this.buildLogObject(
            effectiveServiceName,
            metadata,
            error,
        );

        if (error && level === 'error') {
            this.captureExceptionToSentry(error, message, metadata, logObject);
        }

        childLogger[level](logObject, message);
    }

    private extractContextInfo(
        context: ExecutionContext | string | undefined,
    ): string {
        if (!context) return 'unknown';
        if (typeof context === 'string') {
            return context;
        }
        try {
            const request = context.switchToHttp().getRequest();
            return request.url || 'unknown';
        } catch {
            return 'unknown';
        }
    }

    private shouldSkipLog(context: ExecutionContext | string | undefined) {
        return (
            typeof context === 'undefined' ||
            (typeof context === 'string' &&
                ['RouterExplorer', 'RoutesResolver'].includes(context))
        );
    }

    private buildLogObject(
        serviceName: string,
        metadata: Record<string, any>,
        error?: Error,
    ) {
        const traceContext = this.getTraceContext();
        const observabilityContext = this.getObservabilityContext();

        return {
            environment: process.env.API_NODE_ENV || 'unknown',
            serviceName,
            ...metadata,
            metadata,
            ...traceContext,
            ...observabilityContext,
            error: error
                ? { message: error.message, stack: error.stack }
                : undefined,
        };
    }

    private getTraceContext() {
        if (spanContextProvider) {
            const sc = spanContextProvider();
            if (sc) return sc;
        }

        const currentSpan = trace.getActiveSpan();
        if (!currentSpan) {
            return {
                traceId: null,
                spanId: null,
            };
        }

        const context = currentSpan.spanContext();
        return {
            traceId: context.traceId,
            spanId: context.spanId,
        };
    }

    private getObservabilityContext() {
        if (observabilityContextProvider) {
            return observabilityContextProvider() || {};
        }
        return {};
    }

    private captureExceptionToSentry(
        error: Error,
        message: string,
        metadata: Record<string, any>,
        logObject: any,
    ) {
        const safeMetadata = this.safeSerialize({ ...metadata, ...logObject });

        Sentry.withScope((scope) => {
            scope.setTag('environment', process.env.API_NODE_ENV || 'unknown');
            scope.setTag('level', 'error');
            scope.setTag('type', error.name);

            if (logObject?.traceId) {
                scope.setTag('traceId', logObject.traceId);
            }

            if (logObject?.spanId) {
                scope.setTag('spanId', logObject.spanId);
            }

            scope.setExtras({
                ...safeMetadata,
                message,
                stack: error.stack,
                name: error.name,
            });

            Sentry.captureException(error, {
                fingerprint: [error.name, error.message],
            });

            console.log('Sentry event captured:', {
                error: error.message,
                traceId: logObject?.traceId,
                spanId: logObject?.spanId,
            });
        });
    }

    private safeSerialize(obj: Record<string, any>): Record<string, any> {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch {
            return { error: 'Failed to serialize metadata for Sentry' };
        }
    }
}

/**
 * Create a logger instance
 */
export function createLogger(component: string): SimpleLogger {
    return new SimpleLogger(component);
}

/**
 * Add a log processor
 */
export function addLogProcessor(processor: LogProcessor): void {
    globalLogProcessors.push(processor);
}

/**
 * Remove a log processor
 */
export function removeLogProcessor(processor: LogProcessor): void {
    const index = globalLogProcessors.indexOf(processor);
    if (index > -1) {
        globalLogProcessors.splice(index, 1);
    }
}

/**
 * Clear all log processors
 */
export function clearLogProcessors(): void {
    globalLogProcessors = [];
}

/**
 * Allow ObservabilitySystem to control runtime log level
 */
export function setGlobalLogLevel(level: LogLevel | string): void {
    const logger = getPinoLogger();
    // Pino accepts broader levels; keep flexible
    logger.level = level as any;
}

/**
 * Allow ObservabilitySystem to provide current span context for log correlation
 */
export function setSpanContextProvider(
    provider: (() => { traceId: string; spanId: string } | undefined) | null,
): void {
    spanContextProvider = provider;
}

/**
 * Allow ObservabilitySystem to provide current observability context
 */
export function setObservabilityContextProvider(
    provider:
        | (() =>
              | {
                    correlationId?: string;
                    tenantId?: string;
                    sessionId?: string;
                }
              | undefined)
        | null,
): void {
    observabilityContextProvider = provider;
}
