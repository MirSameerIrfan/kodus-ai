import { CODE_REVIEW_EXECUTION_REPOSITORY } from '@/core/domain/codeReviewExecutions/contracts/codeReviewExecution.repository.contract';
import { CODE_REVIEW_EXECUTION_SERVICE } from '@/core/domain/codeReviewExecutions/contracts/codeReviewExecution.service.contract';
import { CodeReviewExecutionRepository } from '@/core/infrastructure/adapters/repositories/typeorm/codeReviewExecution.repository';
import { CodeReviewExecutionModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/codeReviewExecution.model';
import { CodeReviewExecutionService } from '@/core/infrastructure/adapters/services/codeReviewExecution/codeReviewExecution.service';
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
