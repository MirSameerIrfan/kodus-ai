import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AutomationModule } from '@libs/automation/modules/automation.module';
import { CodebaseModule } from '@libs/code-review/modules/codebase.module'; // Will be CodebaseCoreModule later
import { CodeReviewExecutionModule } from '@libs/code-review/modules/codeReviewExecution.module';
import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';
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
        forwardRef(() => IntegrationConfigCoreModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => CodebaseModule), // Should point to Core when ready
        forwardRef(() => AutomationModule),
        forwardRef(() => CodeReviewExecutionModule),
    ],
    providers: [
        {
            provide: PULL_REQUESTS_REPOSITORY_TOKEN,
            useClass: PullRequestsRepository,
        },
        {
            provide: PULL_REQUESTS_SERVICE_TOKEN,
            useClass: PullRequestsService,
        },
    ],
    exports: [
        PULL_REQUESTS_REPOSITORY_TOKEN,
        PULL_REQUESTS_SERVICE_TOKEN,
        SavePullRequestUseCase,
    ],
})
export class PullRequestsModule {}
