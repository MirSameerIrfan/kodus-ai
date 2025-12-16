import { AutomationStatus } from '../../automation/enum/automation-status';

export type CodeReviewExecution<TAutomationExecution> = {
    uuid: string;
    createdAt: Date;
    updatedAt: Date;

    automationExecution: Partial<TAutomationExecution>;
    status: AutomationStatus;
    message?: string | undefined;
};
