import { Commit } from '@libs/common/types/general/commit.type';
import { DeployFrequency } from './deployFrequency.type';

export type CommitLeadTimeForChange = {
    commit: Commit;
    lastDeploy: DeployFrequency;
    secondToLastDeploy: DeployFrequency;
};
