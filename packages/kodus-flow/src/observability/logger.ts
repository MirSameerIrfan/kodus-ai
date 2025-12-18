import { ExecutionContext } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import pino from 'pino';
import { LogArguments, LogProcessor } from './types.js';
import { LogLevel } from '@/core/types/allTypes.js';

/* -------------------------------------------------------------------------- */
/*                                 Globals                                    */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                         Create / Get Pino Logger                           */
/* -------------------------------------------------------------------------- */

function getPinoLogger(): pino.Logger {
    if (!pinoLogger) {
        const shouldPrettyPrint =
            (process.env.API_LOG_PRETTY || 'false') === 'true';
        const isProduction =
            (process.env.API_NODE_ENV || 'production') === 'production';

        const baseConfig: pino.LoggerOptions = {
            level: process.env.API_LOG_LEVEL || 'info',
            formatters: {
                level: (label) => ({ level: label }),
                log(object) {
                    if (isProduction && !shouldPrettyPrint) {
                        return {
                            message: object.message,
                            serviceName: object.serviceName,
                            environment: object.environment,
                            error: object.error
                                ? { message: (object.error as any)?.message }
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
                ],
                censor: '[REDACTED]',
            },
            timestamp: pino.stdTimeFunctions.isoTime,
            base: {
                pid: process.pid,
                hostname: undefined,
            },
        };

        let logger: pino.Logger;

        if (!shouldPrettyPrint && isProduction) {
            /**
             * Use a worker-thread based transport for performance
             */
            const transport = pino.transport({
                targets: [
                    {
                        target: 'pino/file',
                        options: {
                            destination: 1, // stdout
                            mkdir: false,
                        },
                        level: process.env.API_LOG_LEVEL || 'info',
                    },
                ],
            });

            // Add an error handler to the transport to catch logging pipeline failures
            transport.on('error', (err) => {
                // Use console.error as a safe fallback
                console.error('Pino transport failure:', err);
            });

            logger = pino(baseConfig, transport);
        } else {
            /**
             * Development / pretty mode
             */
            logger = pino(
                {
                    ...baseConfig,
                    transport: shouldPrettyPrint
                        ? {
                              target: 'pino-pretty',
                              options: {
                                  colorize: true,
                                  translateTime: 'SYS:standard',
                                  ignore: 'pid,hostname',
                                  levelFirst: true,
                                  errorProps: 'message,stack',
                                  messageFormat:
                                      '{level} | {serviceName} | {context} | {msg}',
                              },
                          }
                        : undefined,
                },
                undefined,
            );
        }

        pinoLogger = logger;
    }
    return pinoLogger;
}

/* -------------------------------------------------------------------------- */
/*                                   Logger Class                              */
/* -------------------------------------------------------------------------- */

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

        childLogger[level](logObject, message);

        // Forward to global log processors (e.g., MongoDB exporter)
        for (const processor of globalLogProcessors) {
            try {
                processor.process(
                    level,
                    message,
                    { ...metadata, component: effectiveServiceName },
                    error,
                );
            } catch {
                // Fail silently to avoid recursion/crash
            }
        }
    }

    private extractContextInfo(
        context: ExecutionContext | string | undefined,
    ): string {
        if (!context) return 'unknown';
        if (typeof context === 'string') return context;
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
        return {
            environment: process.env.API_NODE_ENV || 'unknown',
            serviceName,
            ...metadata,
            metadata,
            ...this.getTraceContext(),
            ...this.getObservabilityContext(),
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
            return { traceId: null, spanId: null };
        }

        const ctx = currentSpan.spanContext();
        return {
            traceId: ctx.traceId,
            spanId: ctx.spanId,
        };
    }

    private getObservabilityContext() {
        if (observabilityContextProvider) {
            return observabilityContextProvider() || {};
        }
        return {};
    }
}

/* -------------------------------------------------------------------------- */
/*                                   Public API                                */
/* -------------------------------------------------------------------------- */

export function createLogger(component: string): SimpleLogger {
    return new SimpleLogger(component);
}

export function addLogProcessor(processor: LogProcessor): void {
    globalLogProcessors.push(processor);
}

export function removeLogProcessor(processor: LogProcessor): void {
    const index = globalLogProcessors.indexOf(processor);
    if (index > -1) {
        globalLogProcessors.splice(index, 1);
    }
}

export function clearLogProcessors(): void {
    globalLogProcessors = [];
}

export function setGlobalLogLevel(level: LogLevel | string): void {
    getPinoLogger().level = level as any;
}

export function setSpanContextProvider(
    provider: (() => { traceId: string; spanId: string } | undefined) | null,
): void {
    spanContextProvider = provider;
}

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
