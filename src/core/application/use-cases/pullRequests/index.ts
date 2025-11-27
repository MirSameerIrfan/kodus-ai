import { BackfillHistoricalPRsUseCase } from './backfill-historical-prs.use-case';
import { GetEnrichedPullRequestsUseCase } from './get-enriched-pull-requests.use-case';
import { SavePullRequestUseCase } from './save.use-case';

export const UseCases = [
    SavePullRequestUseCase,
    GetEnrichedPullRequestsUseCase,
    BackfillHistoricalPRsUseCase,
];
