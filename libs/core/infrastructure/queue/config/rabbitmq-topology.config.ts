/**
 * Centralized RabbitMQ Topology Configuration.
 * This file serves as the single source of truth for ALL exchanges in the application.
 * Queues are defined directly in the @RabbitSubscribe decorators of their respective consumers.
 */
export const RABBITMQ_TOPOLOGY_CONFIG = {
    exchanges: [
        // =================================================================
        // CORE EXCHANGES (Shared across multiple domains)
        // =================================================================
        {
            name: 'orchestrator.exchange.dlx',
            type: 'topic',
            durable: true,
        },
        {
            name: 'orchestrator.exchange.delayed',
            type: 'x-delayed-message',
            durable: true,
            options: {
                arguments: {
                    'x-delayed-type': 'topic',
                },
            },
        },

        // =================================================================
        // WORKFLOW DOMAIN EXCHANGES
        // =================================================================
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
};
