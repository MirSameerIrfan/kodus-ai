import { Commit } from '@shared/types/general/commit.type';
import { DeployFrequency } from './deployFrequency.type';

export type CommitLeadTimeForChange = {
    commit: Commit;
    lastDeploy: DeployFrequency;
    secondToLastDeploy: DeployFrequency;
};
