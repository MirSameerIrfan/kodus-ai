import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';

import { ICodeReviewFeedbackRepository } from './codeReviewFeedback.repository';
import {
    IPullRequests,
    IRepository,
} from '../../pullRequests/interfaces/pullRequests.interface';
import { CodeReviewFeedbackEntity } from '../entities/codeReviewFeedback.entity';

export const CODE_REVIEW_FEEDBACK_SERVICE_TOKEN = Symbol(
    'CodeReviewFeedbackService',
);

export interface ICodeReviewFeedbackService extends ICodeReviewFeedbackRepository {
    getByOrganizationId(
        organizationId: string,
    ): Promise<CodeReviewFeedbackEntity[]>;

    bulkCreateTransformed(
        organizationAndTeamData: OrganizationAndTeamData,
        comments: { id: number; pullRequestReviewId?: string }[],
        pullRequest: Pick<IPullRequests, 'uuid' | 'number'>,
        repository: Pick<IRepository, 'id' | 'fullName'>,
    ): Promise<CodeReviewFeedbackEntity[]>;
}
