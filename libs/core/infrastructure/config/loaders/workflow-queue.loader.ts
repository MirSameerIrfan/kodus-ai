import { registerAs } from '@nestjs/config';
import { WorkflowQueueConfig } from '../types/general/workflow-queue.type';

export const WorkflowQueueLoader = registerAs(
    'workflowQueue',
    (): WorkflowQueueConfig => ({
        WORKFLOW_QUEUE_WORKER_PREFETCH: parseInt(
            process.env.WORKFLOW_QUEUE_WORKER_PREFETCH || '1',
            10,
        ),
        WORKFLOW_QUEUE_WORKER_MAX_RETRIES: parseInt(
            process.env.WORKFLOW_QUEUE_WORKER_MAX_RETRIES || '3',
            10,
        ),
        WORKFLOW_QUEUE_WORKER_RETRY_DELAY_MS: parseInt(
            process.env.WORKFLOW_QUEUE_WORKER_RETRY_DELAY_MS || '1000',
            10,
        ),
        WORKFLOW_QUEUE_CIRCUIT_BREAKER_FAILURE_THRESHOLD: parseInt(
            process.env.WORKFLOW_QUEUE_CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5',
            10,
        ),
        WORKFLOW_QUEUE_CIRCUIT_BREAKER_TIMEOUT_MS: parseInt(
            process.env.WORKFLOW_QUEUE_CIRCUIT_BREAKER_TIMEOUT_MS || '60000',
            10,
        ),
        WORKFLOW_QUEUE_AUTO_SCALE_ENABLED:
            process.env.WORKFLOW_QUEUE_AUTO_SCALE_ENABLED === 'true' || false,
        WORKFLOW_QUEUE_AUTO_SCALE_MIN_WORKERS: parseInt(
            process.env.WORKFLOW_QUEUE_AUTO_SCALE_MIN_WORKERS || '1',
            10,
        ),
        WORKFLOW_QUEUE_AUTO_SCALE_MAX_WORKERS: parseInt(
            process.env.WORKFLOW_QUEUE_AUTO_SCALE_MAX_WORKERS || '10',
            10,
        ),
        WORKFLOW_QUEUE_AUTO_SCALE_QUEUE_THRESHOLD: parseInt(
            process.env.WORKFLOW_QUEUE_AUTO_SCALE_QUEUE_THRESHOLD || '50',
            10,
        ),
    }),
);
