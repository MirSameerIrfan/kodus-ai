import { AutomationStatus } from '@libs/automation/domain/enums/automation-status';
import { IAutomationExecution } from '@libs/automation/domain/interfaces/automation-execution.interface';

export type CodeReviewExecution = {
    uuid: string;
    createdAt: Date;
    updatedAt: Date;

    automationExecution: Partial<IAutomationExecution>;
    status: AutomationStatus;
    message?: string | undefined;
};
