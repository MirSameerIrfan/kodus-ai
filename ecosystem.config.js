module.exports = {
    apps: [
        {
            name: 'kodus-orchestrator',
            script: './dist/src/main.js',
            out_file: '/app/logs/kodus-orchestrator/out.log',
            error_file: '/app/logs/kodus-orchestrator/error.log',
            env_homolog: {
                API_NODE_ENV: 'homolog',
            },
            env_production: {
                API_NODE_ENV: 'production',
            },
        },
        {
            name: 'workflow-worker',
            script: './dist/src/worker.js',
            instances: 1, // Aumentar conforme necessário
            exec_mode: 'cluster',
            env: {
                WORKFLOW_QUEUE_WORKER_ENABLED: 'true',
                API_NODE_ENV: 'development',
            },
            env_homolog: {
                WORKFLOW_QUEUE_WORKER_ENABLED: 'true',
                API_NODE_ENV: 'homolog',
            },
            env_production: {
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
