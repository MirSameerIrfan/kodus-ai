import 'source-map-support/register';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import expressRateLimit from 'express-rate-limit';
import helmet from 'helmet';
import * as volleyball from 'volleyball';
import * as bodyParser from 'body-parser';
import { WebhookHandlerModule } from './modules/webhook-handler.module';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { HttpServerConfiguration } from '@/config/types';
import { environment } from '@/ee/configs/environment';

async function bootstrap() {
    // Define tipo de componente para configuração de pool de DB
    process.env.COMPONENT_TYPE = 'webhook';

    // Inicializa Sentry e OpenTelemetry antes de tudo
    // setupSentryAndOpenTelemetry();

    const app = await NestFactory.create<NestExpressApplication>(
        WebhookHandlerModule,
        {
            snapshot: true,
        },
    );

    const pinoLogger = app.get(PinoLoggerService);
    app.useLogger(pinoLogger);

    const configService: ConfigService = app.get(ConfigService);
    const config = configService.get<HttpServerConfiguration>('server');
    const { host } = config;

    // Webhook handler runs on port 3332 (different from API REST)
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
            max: 1000, // 1000 requests per minute (webhooks can be bursty)
            legacyHeaders: false,
        }),
    );

    process.on('uncaughtException', (error) => {
        pinoLogger.error({
            message: `Uncaught Exception: ${error.message}`,
            context: 'WebhookHandlerGlobalExceptionHandler',
            error,
        });
    });

    process.on('unhandledRejection', (reason: any) => {
        pinoLogger.error({
            message: `Unhandled Rejection: ${reason?.message || reason}`,
            context: 'WebhookHandlerGlobalExceptionHandler',
            error: reason instanceof Error ? reason : new Error(String(reason)),
        });
    });

    app.use(bodyParser.urlencoded({ extended: true }));
    app.set('trust proxy', '127.0.0.1');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
        pinoLogger.log({
            message: `Received ${signal}, shutting down gracefully...`,
            context: 'WebhookHandlerShutdown',
        });

        try {
            await app.close();
            pinoLogger.log({
                message: 'Webhook handler shutdown complete',
                context: 'WebhookHandlerShutdown',
            });
            process.exit(0);
        } catch (error) {
            pinoLogger.error({
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
}

bootstrap().catch((error) => {
    console.error('Failed to start webhook handler:', error);
    process.exit(1);
});
