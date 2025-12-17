import 'source-map-support/register';
import * as dotenv from 'dotenv';
dotenv.config();

process.env.API_RABBITMQ_ENABLED = 'true';

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

declare const module: any;

async function bootstrap() {
    process.env.COMPONENT_TYPE = 'worker';
    Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose']);
    console.log('Starting Worker bootstrap...');

    try {
        const app = await NestFactory.create(WorkerModule);

        // This enables the NestJS built-in shutdown hooks,
        // which will properly handle SIGINT and SIGTERM.
        app.enableShutdownHooks();

        await app.init();

        // Keep the application running
        setInterval(
            () => {
                // Keep alive
            },
            1000 * 60 * 60,
        ); // 1 hour interval just to keep process alive

        console.log('🚀 Worker is initialized and running.');
    } catch (e) {
        console.error('BOOTSTRAP FAILED', e);
        process.exit(1);
    }
}

bootstrap();
