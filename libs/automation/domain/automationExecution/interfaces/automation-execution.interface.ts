import { CodeReviewExecution } from '@libs/code-review/domain/executions/interfaces/codeReviewExecution.interface';

import { ITeamAutomation } from './team-automation.interface';
import { AutomationStatus } from '../enums/automation-status';

export interface IAutomationExecution {
    uuid: string;
    createdAt?: Date;
    updatedAt?: Date;
    status: AutomationStatus;
    errorMessage?: string;
    dataExecution?: any;
    pullRequestNumber?: number;
    repositoryId?: string;
    teamAutomation?: Partial<ITeamAutomation>;
    codeReviewExecutions?: Array<Partial<CodeReviewExecution>>;
    origin: string;
}
