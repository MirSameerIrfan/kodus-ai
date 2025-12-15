import 'source-map-support/register';
import * as dotenv from 'dotenv';
dotenv.config();

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { createLogger } from '@kodus/flow';

import { WorkflowQueueLoader } from '@libs/core/infrastructure/config/loaders/workflow-queue.loader';

import { WorkerModule } from './worker.module';

async function bootstrap() {
    process.env.COMPONENT_TYPE = 'worker';

    const app = await NestFactory.createApplicationContext(WorkerModule, {
        logger: false,
    });

    const logger = createLogger('WorkerBootstrap');

    const configService: ConfigService = app.get(ConfigService);
    const workflowConfig = configService.get<
        ReturnType<typeof WorkflowQueueLoader>
    >('workflowQueueConfig');

    if (!workflowConfig?.WORKFLOW_QUEUE_WORKER_ENABLED) {
        logger.warn({
            message: 'Workflow queue worker is disabled. Exiting.',
            context: 'WorkerBootstrap',
        });
        await app.close();
        process.exit(0);
    }

    logger.log({
        message: '🔄 Starting Workflow queue worker initialization...',
        context: 'WorkerBootstrap',
        metadata: {
            environment: configService.get('API_CLOUD_MODE')
                ? 'CLOUD'
                : 'SELF-HOSTED',
            workerEnabled: workflowConfig.WORKFLOW_QUEUE_WORKER_ENABLED,
            prefetch: workflowConfig.WORKFLOW_QUEUE_WORKER_PREFETCH,
            maxRetries: workflowConfig.WORKFLOW_QUEUE_WORKER_MAX_RETRIES,
            nodeVersion: process.version,
            pid: process.pid,
        },
    });

    process.on('uncaughtException', (error) => {
        logger.error({
            message: `Uncaught Exception: ${error.message}`,
            context: 'WorkerGlobalExceptionHandler',
            error,
        });
    });

    process.on('unhandledRejection', (reason: any) => {
        logger.error({
            message: `Unhandled Rejection: ${reason?.message || reason}`,
            context: 'WorkerGlobalExceptionHandler',
            error: reason instanceof Error ? reason : new Error(String(reason)),
        });
    });

    const shutdown = async (signal: string) => {
        logger.log({
            message: `Received ${signal}, shutting down gracefully...`,
            context: 'WorkerShutdown',
            metadata: {
                uptime: `${Math.round(process.uptime())}s`,
            },
        });

        try {
            await app.close();
            logger.log({
                message: 'Worker shutdown complete',
                context: 'WorkerShutdown',
            });
            process.exit(0);
        } catch (error) {
            logger.error({
                message: 'Error during worker shutdown',
                context: 'WorkerShutdown',
                error,
            });
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    logger.log({
        message: '🚀 Workflow queue worker is fully initialized and running',
        context: 'WorkerBootstrap',
        metadata: {
            pid: process.pid,
            timestamp: new Date().toISOString(),
        },
    });
}

bootstrap().catch((error) => {
    console.error('Failed to start workflow worker:', error);
    process.exit(1);
});
