// rabbitMQWrapper.module.ts
import { Module, DynamicModule, Provider, Global } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQLoader } from '@core/config/loaders/rabbitmq.loader';
import { RabbitmqConsumeErrorFilter } from '@shared/infrastructure/filters/rabbitmq-consume-error.exception';
import { MESSAGE_BROKER_SERVICE_TOKEN } from '@shared/contracts/message-broker.service.contracts';
import { MessageBrokerService } from '@core/queue/messageBroker/messageBroker.service';
import { AutomationStrategyModule } from './automationStrategy.module';
import { CodeReviewFeedbackConsumer } from '@core/queue/messageBroker/consumers/codeReviewFeedback.consumer';
import { CodeReviewFeedbackModule } from './codeReviewFeedback.module';

@Global()
@Module({})
export class RabbitMQWrapperModule {
    static register(): DynamicModule {
        const imports = [
            ConfigModule.forRoot(),
            ConfigModule.forFeature(RabbitMQLoader),
            CodeReviewFeedbackModule,
            AutomationStrategyModule,
        ];

        const providers: Provider[] = [
            {
                provide: MESSAGE_BROKER_SERVICE_TOKEN,
                useClass: MessageBrokerService,
            },
        ];

        const exports = [MESSAGE_BROKER_SERVICE_TOKEN];

        // Using a factory function to obtain the ConfigService
        const rabbitMQModule = RabbitMQModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => {
                const rabbitMQEnabled =
                    process.env.API_RABBITMQ_ENABLED === 'true';

                if (!rabbitMQEnabled) {
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
                                    'x-dead-letter-exchange': 'workflow.exchange.dlx',
                                    'x-dead-letter-routing-key': 'workflow.jobs.dlq',
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

        const rabbitMQEnabled = process.env.API_RABBITMQ_ENABLED === 'true';

        if (rabbitMQEnabled) {
            imports.push(rabbitMQModule);

            providers.push(
                CodeReviewFeedbackConsumer,
                RabbitmqConsumeErrorFilter,
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
