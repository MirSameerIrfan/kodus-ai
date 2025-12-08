import { CODE_REVIEW_EXECUTION_REPOSITORY } from '@libs/code-review/domain/executions/contracts/codeReviewExecution.repository.contract';
import { CODE_REVIEW_EXECUTION_SERVICE } from '@libs/code-review/domain/executions/contracts/codeReviewExecution.service.contract';
import { CodeReviewExecutionRepository } from '@libs/code-review/infrastructure/repositories/codeReviewExecution.repository';
import { CodeReviewExecutionModel } from '@libs/code-review/infrastructure/repositories/schemas/codeReviewExecution.model';
import { CodeReviewExecutionService } from '@libs/code-review/infrastructure/execution/codeReviewExecution.service';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PullRequestsModule } from './pullRequests.module';

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
