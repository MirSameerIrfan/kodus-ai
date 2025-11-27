import { environment } from '@/ee/configs/environment';
import 'source-map-support/register';

import { createLogger } from '@kodus/flow';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as bodyParser from 'body-parser';
import { useContainer } from 'class-validator';
import expressRateLimit from 'express-rate-limit';
import helmet from 'helmet';
import * as volleyball from 'volleyball';
import { setupSentryAndOpenTelemetry } from './config/log/otel';
import { HttpServerConfiguration } from './config/types/http/http-server.type';
import { AppModule } from './modules/app.module';

async function bootstrap() {
    // Inicializa Sentry e OpenTelemetry antes de tudo
    setupSentryAndOpenTelemetry();

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        snapshot: true,
    });

    const pinoLogger = createLogger('Main');
    // const pinoLogger = app.get(PinoLoggerService);
    // app.useLogger(pinoLogger);

    const configService: ConfigService = app.get(ConfigService);
    const config = configService.get<HttpServerConfiguration>('server');
    const { host, port, rateLimit } = config;

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
    app.use(
        expressRateLimit({
            windowMs: rateLimit.rateInterval,
            max: rateLimit.rateMaxRequest,
            legacyHeaders: false,
        }),
    );

    process.on('uncaughtException', (error) => {
        pinoLogger.error({
            message: `Uncaught Exception: ${error.message}`,
            context: 'GlobalExceptionHandler',
            error,
        });
    });

    process.on('unhandledRejection', (reason: any) => {
        pinoLogger.error({
            message: `Unhandled Rejection: ${reason?.message || reason}`,
            context: 'GlobalExceptionHandler',
            error: reason instanceof Error ? reason : new Error(String(reason)),
        });
    });

    app.use(bodyParser.urlencoded({ extended: true }));
    app.set('trust proxy', '127.0.0.1');

    app.useStaticAssets('static');
    useContainer(app.select(AppModule), { fallbackOnErrors: true });

    console.log(
        `[BOOT] - Running in ${environment.API_CLOUD_MODE ? 'CLOUD' : 'SELF-HOSTED'} mode`,
    );
    await app.listen(port, host, () => {
        console.log(
            `[Server] - Ready on http://${host}:${port}`,
            'Application',
        );
    });
}

bootstrap().catch((error) => {
    console.error(error);
    process.exit(1);
});
