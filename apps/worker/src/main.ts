import 'source-map-support/register';
import * as dotenv from 'dotenv';
dotenv.config();

process.env.API_RABBITMQ_ENABLED = 'true';

import { NestFactory } from '@nestjs/core';
import { ObservabilityService } from '@libs/core/log/observability.service';
import { WorkerModule } from './worker.module';
import { LoggerWrapperService } from '@libs/core/log/loggerWrapper.service';

async function bootstrap() {
    process.env.COMPONENT_TYPE = 'worker';

    console.log('Starting Worker bootstrap...', 'Bootstrap');

    let appContext;

    try {
        appContext = await NestFactory.createApplicationContext(WorkerModule);

        const logger = appContext.get(LoggerWrapperService);
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
                error:
                    reason instanceof Error
                        ? reason
                        : new Error(String(reason)),
            });
        });

        // Explicitly initialize observability for the 'worker' context
        await appContext.get(ObservabilityService).init('worker');

        // This is the crucial step to trigger OnApplicationBootstrap
        await appContext.init();

        appContext.enableShutdownHooks();

        console.log('🚀 Worker is initialized and running.');
    } catch (e) {
        console.error(
            'BOOTSTRAP FAILED',
            e instanceof Error ? e.stack : String(e),
        );

        if (appContext) {
            await appContext.close();
        }
        process.exit(1);
    }
}

bootstrap();
