import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CodeReviewExecutionModel } from '@libs/automation/infrastructure/adapters/repositories/schemas/codeReviewExecution.model';
import { CODE_REVIEW_EXECUTION_SERVICE } from '@libs/automation/domain/codeReviewExecutions/contracts/codeReviewExecution.service.contract';
import { CodeReviewExecutionService } from '@libs/automation/infrastructure/adapters/services/codeReviewExecution.service';
import { CODE_REVIEW_EXECUTION_REPOSITORY } from '@libs/automation/domain/codeReviewExecutions/contracts/codeReviewExecution.repository.contract';
import { CodeReviewExecutionRepository } from '@libs/automation/infrastructure/adapters/repositories/codeReviewExecution.repository';
import {
    PullRequestsModel,
    PullRequestsSchema,
} from '@libs/platformData/infrastructure/adapters/repositories/schemas/pullRequests.model';
import { PULL_REQUESTS_REPOSITORY_TOKEN } from '@libs/platformData/domain/pullRequests/contracts/pullRequests.repository';
import { PullRequestsRepository } from '@libs/platformData/infrastructure/adapters/repositories/pullRequests.repository';
import { PULL_REQUESTS_SERVICE_TOKEN } from '@libs/platformData/domain/pullRequests/contracts/pullRequests.service.contracts';
import { PullRequestsService } from '@libs/platformData/infrastructure/adapters/services/pullRequests.service';
import { SavePullRequestUseCase } from '@libs/platformData/application/use-cases/pullRequests/save.use-case';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: PullRequestsModel.name,
                schema: PullRequestsSchema,
            },
        ]),
        TypeOrmModule.forFeature([CodeReviewExecutionModel]),
    ],
    providers: [
        {
            provide: CODE_REVIEW_EXECUTION_SERVICE,
            useClass: CodeReviewExecutionService,
        },
        {
            provide: CODE_REVIEW_EXECUTION_REPOSITORY,
            useClass: CodeReviewExecutionRepository,
        },
        {
            provide: PULL_REQUESTS_REPOSITORY_TOKEN,
            useClass: PullRequestsRepository,
        },
        {
            provide: PULL_REQUESTS_SERVICE_TOKEN,
            useClass: PullRequestsService,
        },
        SavePullRequestUseCase,
    ],
    exports: [
        CODE_REVIEW_EXECUTION_SERVICE,
        CODE_REVIEW_EXECUTION_REPOSITORY,
        PULL_REQUESTS_REPOSITORY_TOKEN,
        PULL_REQUESTS_SERVICE_TOKEN,
        SavePullRequestUseCase,
    ],
})
export class CodeReviewCoreModule {}

