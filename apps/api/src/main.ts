import 'source-map-support/register';
import { environment } from '@shared/ee/configs/environment';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import expressRateLimit from 'express-rate-limit';
import helmet from 'helmet';
import * as volleyball from 'volleyball';
import * as bodyParser from 'body-parser';
import { useContainer } from 'class-validator';
import { HttpServerConfiguration } from '@shared/types/http/http-server.type';
import { ApiModule } from '@apps/api/api.module';
import { PinoLoggerService } from '@shared/logging/pino.service';
import { setupSentryAndOpenTelemetry } from '@core/config/log/otel';

async function bootstrap() {
    // Define tipo de componente para configuração de pool de DB
    process.env.COMPONENT_TYPE = 'api';

    // Inicializa Sentry e OpenTelemetry antes de tudo
    setupSentryAndOpenTelemetry();

    const app = await NestFactory.create<NestExpressApplication>(ApiModule, {
        snapshot: true,
    });

    const pinoLogger = app.get(PinoLoggerService);
    app.useLogger(pinoLogger);

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
    useContainer(app.select(ApiModule), { fallbackOnErrors: true });

    const apiPort = process.env.API_PORT
        ? parseInt(process.env.API_PORT, 10)
        : port;

    console.log(
        `[BOOT] - API REST running in ${environment.API_CLOUD_MODE ? 'CLOUD' : 'SELF-HOSTED'} mode`,
    );
    await app.listen(apiPort, host, () => {
        console.log(
            `[API REST] - Ready on http://${host}:${apiPort}`,
            'Application',
        );
    });
}

bootstrap().catch((error) => {
    console.error(error);
    process.exit(1);
});
