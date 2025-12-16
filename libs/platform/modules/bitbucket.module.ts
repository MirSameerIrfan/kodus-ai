import { Module, forwardRef } from '@nestjs/common';

import { BitbucketService } from '../infrastructure/adapters/services/bitbucket.service';
import { IntegrationCoreModule } from '@libs/integrations/modules/integrations-core.module';
import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { GlobalCacheModule } from '@libs/core/cache/cache.module';
import { PlatformCoreModule } from './platform-core.module';
import { OrganizationModule } from '@libs/organization/modules/organization.module';
import { AutomationModule } from '@libs/automation/modules/automation.module';
import { PlatformDataModule } from '@libs/platformData/platformData.module';
import { IssuesModule } from '@libs/issues/issues.module';
import { WorkflowModule } from '@libs/core/workflow/workflow.module';
import { AgentsModule } from '@libs/agents/modules/agents.module';
import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';

@Module({
    imports: [
        forwardRef(() => IntegrationCoreModule),
        forwardRef(() => IntegrationConfigCoreModule),
        forwardRef(() => AuthIntegrationModule),
        GlobalCacheModule,
        forwardRef(() => PlatformCoreModule),
        forwardRef(() => OrganizationModule),
        forwardRef(() => AutomationModule),
        forwardRef(() => PlatformDataModule),
        forwardRef(() => IssuesModule),
        forwardRef(() => WorkflowModule),
        forwardRef(() => AgentsModule),
        forwardRef(() => PullRequestsModule),
    ],
    providers: [BitbucketService],
    exports: [BitbucketService],
})
export class BitbucketModule {}
