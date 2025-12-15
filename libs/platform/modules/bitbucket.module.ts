import { Module, forwardRef } from '@nestjs/common';

import { BitbucketService } from '../infrastructure/adapters/services/bitbucket.service';
import { BitbucketPullRequestHandler } from '../infrastructure/webhooks/bitbucket/bitbucketPullRequest.handler';
import { IntegrationCoreModule } from '@libs/integrations/modules/integrations-core.module';
import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { GlobalCacheModule } from '@libs/core/cache/cache.module';
import { PlatformModule } from './platform.module';
import { OrganizationModule } from '@libs/organization/modules/organization.module';
import { AutomationModule } from '@libs/automation/modules/automation.module';
import { PlatformDataModule } from '@libs/platformData/platformData.module';
import { IssuesModule } from '@libs/issues/issues.module';
import { WorkflowModule } from '@libs/core/workflow/workflow.module';
import { AgentsModule } from '@libs/agents/modules/agents.module';
import { KodyRulesModule } from '@libs/kodyRules/modules/kodyRules.module';
import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';

@Module({
    imports: [
        forwardRef(() => IntegrationCoreModule),
        forwardRef(() => IntegrationConfigCoreModule),
        forwardRef(() => AuthIntegrationModule),
        GlobalCacheModule,
        forwardRef(() => PlatformModule),
        forwardRef(() => OrganizationModule),
        forwardRef(() => AutomationModule),
        forwardRef(() => PlatformDataModule),
        forwardRef(() => IssuesModule),
        forwardRef(() => WorkflowModule),
        forwardRef(() => KodyRulesModule),
        forwardRef(() => AgentsModule),
        forwardRef(() => PullRequestsModule),
    ],
    providers: [
        BitbucketService,
        BitbucketPullRequestHandler,
        {
            provide: 'BITBUCKET_WEBHOOK_HANDLER',
            useClass: BitbucketPullRequestHandler,
        },
    ],
    exports: [
        BitbucketService,
        BitbucketPullRequestHandler,
        'BITBUCKET_WEBHOOK_HANDLER',
    ],
})
export class BitbucketModule {}
