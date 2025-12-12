import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CodeReviewExecutionModel } from '@libs/automation/infrastructure/adapters/repositories/schemas/codeReviewExecution.model';
import { CODE_REVIEW_EXECUTION_SERVICE } from '@libs/automation/domain/codeReviewExecutions/contracts/codeReviewExecution.service.contract';
import { CodeReviewExecutionService } from '@libs/automation/infrastructure/adapters/services/codeReviewExecution.service';
import { CODE_REVIEW_EXECUTION_REPOSITORY } from '@libs/automation/domain/codeReviewExecutions/contracts/codeReviewExecution.repository.contract';
import { CodeReviewExecutionRepository } from '@libs/automation/infrastructure/adapters/repositories/codeReviewExecution.repository';
import { PullRequestsModule } from './pull-requests.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([CodeReviewExecutionModel]),
        forwardRef(() => PullRequestsModule),
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
    ],
    exports: [CODE_REVIEW_EXECUTION_SERVICE, CODE_REVIEW_EXECUTION_REPOSITORY],
    controllers: [],
})
export class CodeReviewExecutionModule {}
