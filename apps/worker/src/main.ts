import 'source-map-support/register';
import * as dotenv from 'dotenv';
dotenv.config();

process.env.API_RABBITMQ_ENABLED = 'true';

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@kodus/flow';
import { WorkflowQueueLoader } from '@libs/core/infrastructure/config/loaders/workflow-queue.loader';
import { WorkerModule } from './worker.module';

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        p,
        new Promise<T>((_, rej) =>
            setTimeout(() => rej(new Error(`TIMEOUT (${ms}ms): ${label}`)), ms),
        ),
    ]);
}

async function bootstrap() {
    process.env.COMPONENT_TYPE = 'worker';

    // 1) Não deixe erros “sumirem”
    process.on('unhandledRejection', (e) =>
        console.error('[unhandledRejection]', e),
    );
    process.on('uncaughtException', (e) =>
        console.error('[uncaughtException]', e),
    );

    // 2) Força logs do Nest (inclui logs internos tipo InstanceLoader)
    Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose']);

    console.log('Starting Worker bootstrap...');

    // Diagnostic bootstrap
    const app = await withTimeout(
        NestFactory.createApplicationContext(WorkerModule, {
            abortOnError: false,
        }),
        60_000, // 60s timeout para debug
        'NestFactory.createApplicationContext(WorkerModule)',
    );

    console.log('Worker app created');

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
        message: '🚀 Workflow queue worker is fully initialized and running',
        context: 'WorkerBootstrap',
    });

    // Keep alive logic
    const shutdown = async (signal: string) => {
        logger.log({
            message: `Received ${signal}, shutting down gracefully...`,
            context: 'WorkerShutdown',
        });
        try {
            await app.close();
            process.exit(0);
        } catch (error) {
            console.error('Error shutdown', error);
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((e) => {
    console.error('BOOTSTRAP FAILED', e);
    process.exit(1);
});
