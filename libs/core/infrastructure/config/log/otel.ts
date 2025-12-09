import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SentryContextManager } from '@sentry/nestjs';
import * as Sentry from '@sentry/node';
import { SentryPropagator, SentrySampler } from '@sentry/opentelemetry';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export function setupSentryAndOpenTelemetry() {
    const environment = process.env.API_NODE_ENV || 'development';
    const dsn = process.env.API_SENTRY_DNS;
    const serviceName = 'kodus-orchestrator';

    if (!dsn) {
        console.log('API_SENTRY_DNS não definido. Sentry desabilitado.');
        return;
    }

    console.log('Configurando Sentry com DSN:', dsn);

    Sentry.init({
        dsn: dsn,
        environment: environment,
        release: `kodus-orchestrator@${
            process.env.SENTRY_RELEASE || environment
        }`,
        integrations: [nodeProfilingIntegration()],
        tracesSampleRate: 1.0,
        profilesSampleRate: 1.0,
    });

    const provider = new NodeTracerProvider({
        sampler: new SentrySampler(Sentry.getClient()),
    });

    provider.register({
        propagator: new SentryPropagator(),
        contextManager: new SentryContextManager(),
    });

    registerInstrumentations({
        instrumentations: [
            new HttpInstrumentation(),
            new ExpressInstrumentation(),
            new NestInstrumentation(),
            new PinoInstrumentation({
                logHook: (span, record) => {
                    const spanContext = span.spanContext();
                    record['resource.service.name'] = serviceName;
                    record['traceId'] = spanContext.traceId;
                    record['spanId'] = spanContext.spanId;
                },
            }),
        ],
    });

    console.log('Sentry e OpenTelemetry configurados com sucesso');
}
