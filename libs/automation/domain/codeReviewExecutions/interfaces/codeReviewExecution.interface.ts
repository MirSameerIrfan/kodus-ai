import { AutomationStatus } from '../../automation/enum/automation-status';
import { IAutomationExecution } from '../../automationExecution/interfaces/automation-execution.interface';

export type CodeReviewExecution = {
    uuid: string;
    createdAt: Date;
    updatedAt: Date;

    automationExecution: Partial<IAutomationExecution>;
    status: AutomationStatus;
    message?: string | undefined;
};
