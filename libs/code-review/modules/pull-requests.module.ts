import { UseCases } from '@libs/core/application/use-cases/pullRequests';
import { SavePullRequestUseCase } from '@libs/core/application/use-cases/pullRequests/save.use-case';
import { PULL_REQUESTS_REPOSITORY_TOKEN } from '@libs/core/domain/pullRequests/contracts/pullRequests.repository';
import { PULL_REQUESTS_SERVICE_TOKEN } from '@libs/core/domain/pullRequests/contracts/pullRequests.service.contracts';
import { PullRequestsRepository } from '@libs/core/infrastructure/adapters/repositories/mongoose/pullRequests.repository';
import {
    PullRequestsModel,
    PullRequestsSchema,
} from '@libs/core/infrastructure/adapters/repositories/mongoose/schema/pullRequests.model';
import { PullRequestsService } from '@libs/core/infrastructure/adapters/services/pullRequests/pullRequests.service';
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { PlatformIntegrationModule } from '@libs/platform/platform.module';
import { PullRequestController } from '@libs/core/infrastructure/http/controllers/pullRequest.controller';
import { CodebaseModule } from '@libs/code-review/code-review.module';
import { AutomationModule } from '@libs/automation/automation.module';
import { CodeReviewExecutionModule } from '@libs/codeReviewExecution.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: PullRequestsModel.name,
                schema: PullRequestsSchema,
            },
        ]),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => AutomationModule),
        forwardRef(() => CodeReviewExecutionModule),
    ],
    providers: [
        ...UseCases,
        {
            provide: PULL_REQUESTS_REPOSITORY_TOKEN,
            useClass: PullRequestsRepository,
        },
        {
            provide: PULL_REQUESTS_SERVICE_TOKEN,
            useClass: PullRequestsService,
        },
    ],
    controllers: [PullRequestController],
    exports: [
        PULL_REQUESTS_REPOSITORY_TOKEN,
        PULL_REQUESTS_SERVICE_TOKEN,
        SavePullRequestUseCase,
        ...UseCases,
    ],
})
export class PullRequestsModule {}
