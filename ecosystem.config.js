module.exports = {
    apps: [
        {
            name: 'webhook-handler',
            script: './dist/src/webhook-handler.js',
            instances: 1, // Pode escalar horizontalmente conforme necessário
            exec_mode: 'fork', // Fork mode para webhook handler (stateless)
            env: {
                COMPONENT_TYPE: 'webhook',
                WEBHOOK_HANDLER_PORT: '3332',
                API_NODE_ENV: 'development',
            },
            env_homolog: {
                COMPONENT_TYPE: 'webhook',
                WEBHOOK_HANDLER_PORT: '3332',
                API_NODE_ENV: 'homolog',
            },
            env_production: {
                COMPONENT_TYPE: 'webhook',
                WEBHOOK_HANDLER_PORT: '3332',
                API_NODE_ENV: 'production',
            },
            out_file: '/app/logs/webhook-handler/out.log',
            error_file: '/app/logs/webhook-handler/error.log',
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',
            kill_timeout: 5000,
        },
        {
            name: 'kodus-orchestrator',
            script: './dist/src/main.js',
            instances: 1,
            exec_mode: 'fork',
            env: {
                COMPONENT_TYPE: 'api',
                API_PORT: '3331',
                API_NODE_ENV: 'development',
            },
            env_homolog: {
                COMPONENT_TYPE: 'api',
                API_PORT: '3331',
                API_NODE_ENV: 'homolog',
            },
            env_production: {
                COMPONENT_TYPE: 'api',
                API_PORT: '3331',
                API_NODE_ENV: 'production',
            },
            out_file: '/app/logs/kodus-orchestrator/out.log',
            error_file: '/app/logs/kodus-orchestrator/error.log',
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',
            kill_timeout: 5000,
        },
        {
            name: 'workflow-worker',
            script: './dist/src/worker.js',
            instances: 1, // Aumentar conforme necessário
            exec_mode: 'cluster', // Cluster mode para workers (pode escalar)
            env: {
                COMPONENT_TYPE: 'worker',
                WORKFLOW_QUEUE_WORKER_ENABLED: 'true',
                API_NODE_ENV: 'development',
            },
            env_homolog: {
                COMPONENT_TYPE: 'worker',
                WORKFLOW_QUEUE_WORKER_ENABLED: 'true',
                API_NODE_ENV: 'homolog',
            },
            env_production: {
                COMPONENT_TYPE: 'worker',
                WORKFLOW_QUEUE_WORKER_ENABLED: 'true',
                API_NODE_ENV: 'production',
            },
            out_file: '/app/logs/workflow-worker/out.log',
            error_file: '/app/logs/workflow-worker/error.log',
            // Auto-restart em caso de crash
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',
            // Aguardar 5 segundos antes de considerar como crash
            kill_timeout: 5000,
        },
    ],
};
