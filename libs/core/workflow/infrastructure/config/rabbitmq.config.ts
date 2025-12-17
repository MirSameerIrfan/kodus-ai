// Configurações de filas e exchanges para o módulo de Workflow
export const WORKFLOW_QUEUE_CONFIG = {
    exchanges: [
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
            name: 'workflow.jobs.queue',
            exchange: 'workflow.exchange',
            routingKey: 'workflow.job.created',
            createQueueIfNotExists: true,
            queueOptions: {
                durable: true,
                arguments: {
                    'x-queue-type': 'quorum',
                    'x-dead-letter-exchange': 'workflow.exchange.dlx',
                    'x-dead-letter-routing-key': 'workflow.job.failed',
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
};
