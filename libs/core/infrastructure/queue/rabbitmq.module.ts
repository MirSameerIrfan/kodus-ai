import * as dotenv from 'dotenv';
dotenv.config();

// rabbitMQWrapper.module.ts
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import {
    Module,
    DynamicModule,
    Provider,
    Global,
    ModuleMetadata,
    Type,
    ForwardReference,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { MESSAGE_BROKER_SERVICE_TOKEN } from '@libs/core/domain/contracts/message-broker.service.contracts';
import { RabbitMQLoader } from '@libs/core/infrastructure/config/loaders/rabbitmq.loader';
import { RabbitmqConsumeErrorFilter } from '@libs/core/infrastructure/filters/rabbitmq-consume-error.exception';
import { MessageBrokerService } from '@libs/core/infrastructure/queue/messageBroker/messageBroker.service';

export interface RabbitMQWrapperOptions {
    enableConsumers: boolean;
}

@Global()
@Module({})
export class RabbitMQWrapperModule {
    static register(
        options: RabbitMQWrapperOptions = { enableConsumers: true },
    ): DynamicModule {
        const imports: (
            | Type<any>
            | DynamicModule
            | Promise<DynamicModule>
            | ForwardReference
        )[] = [ConfigModule.forRoot(), ConfigModule.forFeature(RabbitMQLoader)];

        // Only import heavy business modules if consumers are enabled
        /*if (options.enableConsumers) {
            imports.push(CodeReviewFeedbackModule, AutomationModule);
        }*/

        const providers: Provider[] = [
            {
                provide: MESSAGE_BROKER_SERVICE_TOKEN,
                useClass: MessageBrokerService,
            },
        ];

        const exports: ModuleMetadata['exports'] = [
            MESSAGE_BROKER_SERVICE_TOKEN,
        ];

        // Using a factory function to obtain the ConfigService
        const rabbitMQModule = RabbitMQModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => {
                const rabbitMQEnabled =
                    process.env.API_RABBITMQ_ENABLED !== 'false';

                console.log(
                    `[RabbitMQWrapperModule] Factory running. ENABLED=${rabbitMQEnabled}, ENV_VAR=${process.env.API_RABBITMQ_ENABLED}`,
                );

                if (!rabbitMQEnabled) {
                    console.log(
                        `[RabbitMQWrapperModule] Returning empty config because it is disabled.`,
                    );
                    return null;
                }

                return {
                    exchanges: [
                        {
                            name: 'orchestrator.exchange.delayed',
                            type: 'x-delayed-message',
                            durable: true,
                            options: {
                                arguments: {
                                    'x-delayed-type': 'direct',
                                },
                            },
                        },
                        {
                            name: 'orchestrator.exchange.dlx',
                            type: 'topic',
                            durable: true,
                        },
                        {
                            name: 'workflow.exchange',
                            type: 'topic',
                            durable: true,
                        },
                        {
                            name: 'workflow.exchange.dlx',
                            type: 'topic',
                            durable: true,
                        },
                        {
                            name: 'workflow.events',
                            type: 'topic',
                            durable: true,
                        },
                    ],
                    queues: [
                        {
                            name: 'dlx.queue',
                            exchange: 'orchestrator.exchange.dlx',
                            routingKey: '#',
                            createQueueIfNotExists: true,
                            queueOptions: {
                                durable: true,
                            },
                        },
                        {
                            name: 'workflow.jobs.queue',
                            exchange: 'workflow.exchange',
                            routingKey: 'workflow.job.created',
                            createQueueIfNotExists: true,
                            queueOptions: {
                                durable: true,
                                arguments: {
                                    'x-queue-type': 'quorum',
                                    'x-dead-letter-exchange':
                                        'workflow.exchange.dlx',
                                    'x-dead-letter-routing-key':
                                        'workflow.job.failed',
                                },
                            },
                        },
                        {
                            name: 'workflow.dlx.queue',
                            exchange: 'workflow.exchange.dlx',
                            routingKey: '#',
                            createQueueIfNotExists: true,
                            queueOptions: {
                                durable: true,
                            },
                        },
                        {
                            name: 'workflow.events.ast',
                            exchange: 'workflow.events',
                            routingKey: 'ast.task.completed',
                            createQueueIfNotExists: true,
                            queueOptions: {
                                durable: true,
                                arguments: {
                                    'x-queue-type': 'quorum',
                                },
                            },
                        },
                        {
                            name: 'workflow.jobs.resumed.queue',
                            exchange: 'workflow.exchange',
                            routingKey: 'workflow.jobs.resumed',
                            createQueueIfNotExists: true,
                            queueOptions: {
                                durable: true,
                                arguments: {
                                    'x-queue-type': 'quorum',
                                    'x-dead-letter-exchange':
                                        'workflow.exchange.dlx',
                                    'x-dead-letter-routing-key':
                                        'workflow.jobs.dlq',
                                },
                            },
                        },
                    ],
                    uri: configService.get<string>(
                        'rabbitMQConfig.API_RABBITMQ_URI',
                    ),
                    connectionInitOptions: {
                        wait: false,
                        timeout: 5000,
                        heartbeat: 60,
                    },
                    reconnectTimeInSeconds: 10,
                    enableControllerDiscovery: false,
                    prefetchCount: 1,
                };
            },
            inject: [ConfigService],
        });

        const rabbitMQEnabled = process.env.API_RABBITMQ_ENABLED !== 'false';

        // Add logging to debug
        console.log(
            `[RabbitMQWrapperModule] Registering module. ENABLED=${rabbitMQEnabled}, ENV_VAR=${process.env.API_RABBITMQ_ENABLED}`,
        );

        if (rabbitMQEnabled) {
            console.log(
                '[RabbitMQWrapperModule] RabbitMQ is ENABLED. Adding RabbitMQModule to imports.',
            );
            imports.push(rabbitMQModule);
            exports.push(rabbitMQModule);

            // Only register consumers if enabled
            if (options.enableConsumers) {
                providers.push(RabbitmqConsumeErrorFilter);
            }
        } else {
            console.log(
                '[RabbitMQWrapperModule] RabbitMQ is DISABLED. Skipping RabbitMQModule import.',
            );
        }

        return {
            module: RabbitMQWrapperModule,
            imports: imports,
            providers: providers,
            exports: exports,
        };
    }
}
