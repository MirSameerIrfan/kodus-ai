import 'source-map-support/register';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { PinoLoggerService } from '@libs/core/infrastructure/logging/pino.service';
import { setupSentryAndOpenTelemetry } from '@libs/core/infrastructure/config/log/otel';
import { WorkflowQueueLoader } from '@libs/core/infrastructure/config/loaders/workflow-queue.loader';

async function bootstrap() {
    // Define tipo de componente para configuração de pool de DB
    process.env.COMPONENT_TYPE = 'worker';

    // Inicializa Sentry e OpenTelemetry antes de tudo
    setupSentryAndOpenTelemetry();

    const app = await NestFactory.createApplicationContext(WorkerModule, {
        logger: false,
    });

    const pinoLogger = app.get(PinoLoggerService);
    const configService: ConfigService = app.get(ConfigService);
    const workflowConfig = configService.get<
        ReturnType<typeof WorkflowQueueLoader>
    >('workflowQueueConfig');

    if (!workflowConfig?.WORKFLOW_QUEUE_WORKER_ENABLED) {
        pinoLogger.warn({
            message: 'Workflow queue worker is disabled. Exiting.',
            context: 'WorkerBootstrap',
        });
        await app.close();
        process.exit(0);
    }

    pinoLogger.log({
        message: 'Workflow queue worker started',
        context: 'WorkerBootstrap',
        metadata: {
            environment: configService.get('API_CLOUD_MODE')
                ? 'CLOUD'
                : 'SELF-HOSTED',
            workerEnabled: workflowConfig.WORKFLOW_QUEUE_WORKER_ENABLED,
            prefetch: workflowConfig.WORKFLOW_QUEUE_WORKER_PREFETCH,
            maxRetries: workflowConfig.WORKFLOW_QUEUE_WORKER_MAX_RETRIES,
        },
    });

    process.on('uncaughtException', (error) => {
        pinoLogger.error({
            message: `Uncaught Exception: ${error.message}`,
            context: 'WorkerGlobalExceptionHandler',
            error,
        });
    });

    process.on('unhandledRejection', (reason: any) => {
        pinoLogger.error({
            message: `Unhandled Rejection: ${reason?.message || reason}`,
            context: 'WorkerGlobalExceptionHandler',
            error:
                reason instanceof Error
                    ? new Error(String(reason))
                    : new Error(String(reason)),
        });
    });

    const shutdown = async (signal: string) => {
        pinoLogger.log({
            message: `Received ${signal}, shutting down gracefully...`,
            context: 'WorkerShutdown',
        });

        try {
            await app.close();
            pinoLogger.log({
                message: 'Worker shutdown complete',
                context: 'WorkerShutdown',
            });
            process.exit(0);
        } catch (error) {
            pinoLogger.error({
                message: 'Error during worker shutdown',
                context: 'WorkerShutdown',
                error,
            });
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    pinoLogger.log({
        message: 'Workflow queue worker is ready and listening for jobs',
        context: 'WorkerBootstrap',
    });
}

bootstrap().catch((error) => {
    console.error('Failed to start workflow worker:', error);
    process.exit(1);
});
