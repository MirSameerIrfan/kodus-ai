import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

import { configLoader } from '@libs/core/infrastructure/config/loaders';
import { environmentConfigLoader } from '@libs/core/infrastructure/config/loaders/environment.loader';
import { jwtConfigLoader } from '@libs/core/infrastructure/config/loaders/jwt.config.loader';
import { mongoDBConfigLoader } from '@libs/core/infrastructure/config/loaders/mongodb.config.loader';
import { postgresConfigLoader } from '@libs/core/infrastructure/config/loaders/postgres.config.loader';
import { RabbitMQLoader } from '@libs/core/infrastructure/config/loaders/rabbitmq.loader';
import { serverConfigLoader } from '@libs/core/infrastructure/config/loaders/server.loader';
import { WorkflowQueueLoader } from '@libs/core/infrastructure/config/loaders/workflow-queue.loader';

import { configSchema } from '@libs/core/infrastructure/config/schemas/config.schema';
import { databaseSchema } from '@libs/core/infrastructure/config/schemas/database.schema';

@Global()
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [
                configLoader,
                environmentConfigLoader,
                jwtConfigLoader,
                mongoDBConfigLoader,
                postgresConfigLoader,
                RabbitMQLoader,
                serverConfigLoader,
                WorkflowQueueLoader,
            ],
            validationSchema: Joi.object({})
                .concat(configSchema)
                .concat(databaseSchema),
            validationOptions: {
                allowUnknown: true,
                abortEarly: true,
            },
        }),
    ],
    exports: [ConfigModule],
})
export class SharedConfigModule {}
