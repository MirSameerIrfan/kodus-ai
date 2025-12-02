import { JobStatus } from '../enums/job-status.enum';
import { ErrorClassification } from '../enums/error-classification.enum';
import { WorkflowType } from '../enums/workflow-type.enum';
import { HandlerType } from '../enums/handler-type.enum';

export interface IWorkflowJob {
    id: string;
    correlationId: string;
    workflowType: WorkflowType;
    handlerType: HandlerType;
    payload: Record<string, unknown>;
    organizationId: string;
    teamId?: string;
    status: JobStatus;
    priority: number;
    retryCount: number;
    maxRetries: number;
    errorClassification?: ErrorClassification;
    lastError?: string;
    scheduledAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    currentStage?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
