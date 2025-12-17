import 'source-map-support/register';
import * as dotenv from 'dotenv';
dotenv.config();

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as bodyParser from 'body-parser';
import expressRateLimit from 'express-rate-limit';
import helmet from 'helmet';
import * as volleyball from 'volleyball';

import { HttpServerConfiguration } from '@libs/core/infrastructure/config/types';
import { KodusLoggerService } from '@libs/core/log/kodus-logger.service';

import { WebhookHandlerModule } from './modules/webhook-handler.module';
import { environment } from '@libs/ee/configs/environment';

declare const module: any;

async function bootstrap() {
    process.env.COMPONENT_TYPE = 'webhook';

    const app = await NestFactory.create<NestExpressApplication>(
        WebhookHandlerModule,
        {
            snapshot: true,
        },
    );

    const logger = app.get(KodusLoggerService);
    app.useLogger(logger);

    const configService: ConfigService = app.get(ConfigService);
    const config = configService.get<HttpServerConfiguration>('server');
    const { host } = config;

    const webhookPort = process.env.WEBHOOK_HANDLER_PORT
        ? parseInt(process.env.WEBHOOK_HANDLER_PORT, 10)
        : 3332;

    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    app.enableVersioning();
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });

    app.use(volleyball);
    app.use(helmet());

    // Rate limiting específico para webhooks (mais permissivo que API REST)
    app.use(
        expressRateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 3000,
            legacyHeaders: false,
        }),
    );

    process.on('uncaughtException', (error) => {
        logger.error({
            message: `Uncaught Exception: ${error.message}`,
            context: 'WebhookHandlerGlobalExceptionHandler',
            error,
        });
    });

    process.on('unhandledRejection', (reason: any) => {
        logger.error({
            message: `Unhandled Rejection: ${reason?.message || reason}`,
            context: 'WebhookHandlerGlobalExceptionHandler',
            error: reason instanceof Error ? reason : new Error(String(reason)),
        });
    });

    app.use(bodyParser.urlencoded({ extended: true }));
    app.set('trust proxy', '127.0.0.1');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
        logger.log({
            message: `Received ${signal}, shutting down gracefully...`,
            context: 'WebhookHandlerShutdown',
        });

        try {
            await app.close();
            logger.log({
                message: 'Webhook handler shutdown complete',
                context: 'WebhookHandlerShutdown',
            });
            process.exit(0);
        } catch (error) {
            logger.error({
                message: 'Error during webhook handler shutdown',
                context: 'WebhookHandlerShutdown',
                error,
            });
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    console.log(
        `[BOOT] - Webhook Handler running in ${environment.API_CLOUD_MODE ? 'CLOUD' : 'SELF-HOSTED'} mode`,
    );
    await app.listen(webhookPort, host, () => {
        console.log(
            `[WebhookHandler] - Ready on http://${host}:${webhookPort}`,
            'Application',
        );
    });

    if (module.hot) {
        module.hot.accept();
        module.hot.dispose(() => app.close());
    }
}

bootstrap().catch((error) => {
    console.error('Failed to start webhook handler:', error);
    process.exit(1);
});
