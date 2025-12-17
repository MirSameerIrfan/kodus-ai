// Configurações de filas e exchanges padrão da infraestrutura
export const CORE_QUEUE_CONFIG = {
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
    ],
};
