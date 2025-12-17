import { Module, forwardRef } from '@nestjs/common';

import { ExecuteDryRunUseCase } from './application/use-cases/execute-dry-run.use-case';
import { GetDryRunUseCase } from './application/use-cases/get-dry-run.use-case';
import { GetStatusDryRunUseCase } from './application/use-cases/get-status-dry-run.use-case';
import { ListDryRunsUseCase } from './application/use-cases/list-dry-runs.use-case';
import { SseDryRunUseCase } from './application/use-cases/sse-dry-run.use-case';

import { DryRunCodeReviewPipelineStrategy } from './infrastructure/adapters/services/dry-run-cr-pipeline.strategy';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { PullRequestMessagesModule } from '@libs/code-review/modules/pullRequestMessages.module';
import { CodebaseModule } from '@libs/code-review/modules/codebase.module';
import { CodeReviewPipelineModule } from '@libs/code-review/pipeline/code-review-pipeline.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { DryRunCodeReviewPipeline } from './infrastructure/adapters/services/dryRunPipeline';

import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { OrganizationParametersModule } from '@libs/organization/modules/organizationParameters.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';
import { DryRunCoreModule } from './dry-run-core.module';

@Module({
    imports: [
        DryRunCoreModule,
        forwardRef(() => ParametersModule),
        forwardRef(() => PullRequestMessagesModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => CodeReviewPipelineModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => IntegrationConfigCoreModule),
        forwardRef(() => OrganizationParametersModule),
        EventEmitterModule.forRoot(),
    ],
    providers: [
        DryRunCodeReviewPipelineStrategy,
        DryRunCodeReviewPipeline,
        ExecuteDryRunUseCase,
        GetDryRunUseCase,
        GetStatusDryRunUseCase,
        ListDryRunsUseCase,
        SseDryRunUseCase,
    ],
    exports: [
        ExecuteDryRunUseCase,
        GetDryRunUseCase,
        GetStatusDryRunUseCase,
        ListDryRunsUseCase,
        SseDryRunUseCase,
        DryRunCodeReviewPipelineStrategy,
        DryRunCodeReviewPipeline,
    ],
})
export class DryRunModule {}
