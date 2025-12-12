import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PullRequestsModel } from './infrastructure/adapters/repositories/schemas/pullRequests.model';
import { PullRequestsRepository } from './infrastructure/adapters/repositories/pullRequests.repository';
import { PullRequestsService } from './infrastructure/adapters/services/pullRequests.service';
import { PULL_REQUESTS_REPOSITORY_TOKEN } from './domain/pullRequests/contracts/pullRequests.repository';
import { PULL_REQUESTS_SERVICE_TOKEN } from './domain/pullRequests/contracts/pullRequests.service.contracts';
import { SavePullRequestUseCase } from './application/use-cases/pullRequests/save.use-case';
import { GetEnrichedPullRequestsUseCase } from './application/use-cases/pullRequests/get-enriched-pull-requests.use-case';
import { BackfillHistoricalPRsUseCase } from './application/use-cases/pullRequests/backfill-historical-prs.use-case';

@Module({
    imports: [TypeOrmModule.forFeature([PullRequestsModel])],
    providers: [
        {
            provide: PULL_REQUESTS_REPOSITORY_TOKEN,
            useClass: PullRequestsRepository,
        },
        {
            provide: PULL_REQUESTS_SERVICE_TOKEN,
            useClass: PullRequestsService,
        },
        SavePullRequestUseCase,
        GetEnrichedPullRequestsUseCase,
        BackfillHistoricalPRsUseCase,
    ],
    exports: [
        PULL_REQUESTS_REPOSITORY_TOKEN,
        PULL_REQUESTS_SERVICE_TOKEN,
        SavePullRequestUseCase,
        GetEnrichedPullRequestsUseCase,
        BackfillHistoricalPRsUseCase,
    ],
})
export class PlatformDataModule {}
