import { Module, forwardRef } from '@nestjs/common';
import { GetEnrichedPullRequestsUseCase } from '../application/use-cases/dashboard/get-enriched-pull-requests.use-case';
import { AutomationModule } from '@libs/automation/modules/automation.module';
import { PlatformDataModule } from '@libs/platformData/platformData.module';
import { PermissionsModule } from '@libs/identity/modules/permissions.module';
import { CodeReviewExecutionModule } from '@libs/code-review/modules/codeReviewExecution.module';

@Module({
    imports: [
        forwardRef(() => AutomationModule),
        forwardRef(() => PlatformDataModule),
        forwardRef(() => PermissionsModule),
        forwardRef(() => CodeReviewExecutionModule),
    ],
    providers: [GetEnrichedPullRequestsUseCase],
    exports: [GetEnrichedPullRequestsUseCase],
})
export class CodeReviewDashboardModule {}
