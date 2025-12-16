import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';

import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { IntegrationCoreModule } from '@libs/integrations/modules/integrations-core.module';
import { GithubModule } from './github.module';
import { GitlabModule } from './gitlab.module';
import { BitbucketModule } from './bitbucket.module';
import { AzureReposModule } from './azure-repos.module';

import { PlatformIntegrationFactory } from '../infrastructure/adapters/services/platformIntegration.factory';
import { CodeManagementService } from '../infrastructure/adapters/services/codeManagement.service';
import CodeManagementUseCases from '../application/use-cases/codeManagement';
import { AgentsModule } from '@libs/agents/modules/agents.module';
import { CodeReviewSettingsLogModule } from '@libs/ee/codeReviewSettingsLog/codeReviewSettingsLog.module';
import { OrganizationParametersModule } from '@libs/organization/modules/organizationParameters.module';
import { TeamModule } from '@libs/organization/modules/team.module';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { PlatformDataModule } from '@libs/platformData/platformData.module';
import { PermissionsModule } from '@libs/identity/modules/permissions.module';
import { KodyRulesModule } from '@libs/kodyRules/modules/kodyRules.module';
import { PullRequestMessagesModule } from '@libs/code-review/modules/pullRequestMessages.module';
import { AzureReposPullRequestHandler } from '../infrastructure/webhooks/azure/azureReposPullRequest.handler';
import { GitHubPullRequestHandler } from '../infrastructure/webhooks/github/githubPullRequest.handler';
import { GitLabMergeRequestHandler } from '../infrastructure/webhooks/gitlab/gitlabPullRequest.handler';
import { BitbucketPullRequestHandler } from '../infrastructure/webhooks/bitbucket/bitbucketPullRequest.handler';

import { PlatformCoreModule } from './platform-core.module';

@Module({
    imports: [
        PlatformCoreModule,
        forwardRef(() => IntegrationCoreModule),
        forwardRef(() => IntegrationConfigCoreModule),
        forwardRef(() => AuthIntegrationModule),
        GithubModule,
        GitlabModule,
        BitbucketModule,
        AzureReposModule,
        forwardRef(() => AgentsModule),
        forwardRef(() => CodeReviewSettingsLogModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => TeamModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => PlatformDataModule),
        PermissionsModule,
        forwardRef(() => KodyRulesModule),
        forwardRef(() => PullRequestMessagesModule),
    ],
    providers: [
        ...CodeManagementUseCases,
        AzureReposPullRequestHandler,
        GitHubPullRequestHandler,
        GitLabMergeRequestHandler,
        BitbucketPullRequestHandler,
        {
            provide: 'AZURE_REPOS_WEBHOOK_HANDLER',
            useClass: AzureReposPullRequestHandler,
        },
        {
            provide: 'GITHUB_WEBHOOK_HANDLER',
            useClass: GitHubPullRequestHandler,
        },
        {
            provide: 'GITLAB_WEBHOOK_HANDLER',
            useClass: GitLabMergeRequestHandler,
        },
        {
            provide: 'BITBUCKET_WEBHOOK_HANDLER',
            useClass: BitbucketPullRequestHandler,
        },
    ],
    exports: [
        PlatformCoreModule,
        PlatformIntegrationFactory,
        CodeManagementService,
        ...CodeManagementUseCases,
    ],
})
export class PlatformModule implements OnModuleInit {
    constructor(
        private modulesContainer: ModulesContainer,
        private platformFactory: PlatformIntegrationFactory,
    ) {}

    onModuleInit() {
        // Lógica de registro dos services no factory
    }
}
