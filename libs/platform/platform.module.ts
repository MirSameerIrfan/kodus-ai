import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { GithubModule } from '@libs/platform/modules/github.module';
import { BitbucketModule } from '@libs/bitbucket.module';
import { ICodeManagementService } from '@libs/platform/domain/interfaces/code-management.interface';
import { PlatformIntegrationFactory } from '@libs/infrastructure/adapters/services/platformIntegration/platformIntegration.factory';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { CodeManagementService } from '@libs/infrastructure/adapters/services/platformIntegration/codeManagement.service';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { CodeManagementController } from '@libs/infrastructure/http/controllers/platformIntegration/codeManagement.controller';
import { UseCases } from '@libs/application/use-cases/platformIntegration';
import { GitlabService } from '@libs/infrastructure/adapters/services/gitlab.service';
import { TeamMembersModule } from '@libs/teamMembers.module';
import { TeamsModule } from '@libs/organization/modules/team.module';
import { ProfileConfigModule } from '@libs/identity/modules/profileConfig.module';
import { PromptService } from '@libs/infrastructure/adapters/services/prompt.service';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { GitlabModule } from '@libs/platform/modules/gitlab.module';
import { AgentModule } from '@libs/agent.module';
import { AutomationModule } from '@libs/automation/automation.module';
import { ReceiveWebhookUseCase } from '@libs/application/use-cases/platformIntegration/codeManagement/receiveWebhook.use-case';
import { TeamAutomationModule } from '@libs/teamAutomation.module';
import { OrganizationParametersModule } from '@libs/organization/modules/org-parameters.module';
import { CodeReviewFeedbackModule } from '@libs/code-review/modules/codeReviewFeedback.module';
import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';
import { CodebaseModule } from '@libs/code-review/code-review.module';
import { KodyRulesModule } from '@libs/kody-rules/kody-rules.module';
import { AzureReposModule } from '@libs/azureRepos.module';
import { GitHubPullRequestHandler } from '@libs/infrastructure/adapters/webhooks/github/githubPullRequest.handler';
import { GitLabMergeRequestHandler } from '@libs/infrastructure/adapters/webhooks/gitlab/gitlabPullRequest.handler';
import { BitbucketPullRequestHandler } from '@libs/infrastructure/adapters/webhooks/bitbucket/bitbucketPullRequest.handler';
import { AzureReposPullRequestHandler } from '@libs/infrastructure/adapters/webhooks/azureRepos/azureReposPullRequest.handler';
import { IssuesModule } from '@libs/issues.module';
import { CodeReviewSettingsLogModule } from '@libs/analytics/modules/settings-log.module';
import { McpAgentModule } from '@libs/mcpAgent.module';
import { GetAdditionalInfoHelper } from '@libs/common/utils/helpers/getAdditionalInfo.helper';
import { GET_ADDITIONAL_INFO_HELPER_TOKEN } from '@libs/common/domain/contracts/getAdditionalInfo.helper.contract';
import { PullRequestMessagesModule } from '@libs/code-review/modules/pullRequestMessages.module';
import { WorkflowQueueModule } from '@libs/workflowQueue.module';
@Module({
    imports: [
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => AuthIntegrationModule),
        forwardRef(() => GithubModule),
        forwardRef(() => GitlabModule),
        forwardRef(() => TeamMembersModule),
        forwardRef(() => TeamsModule),
        forwardRef(() => ProfileConfigModule),
        forwardRef(() => AgentModule),
        forwardRef(() => AutomationModule),
        forwardRef(() => TeamAutomationModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => CodeReviewFeedbackModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => KodyRulesModule),
        forwardRef(() => AzureReposModule),
        forwardRef(() => BitbucketModule),
        forwardRef(() => IssuesModule),
        forwardRef(() => CodeReviewSettingsLogModule),
        forwardRef(() => PullRequestMessagesModule),
        PullRequestsModule,
        McpAgentModule,
        forwardRef(() => WorkflowQueueModule),
    ],
    providers: [
        ...UseCases,
        PromptService,
        PlatformIntegrationFactory,
        CodeManagementService,

        //Integrations tools
        GitlabService,

        // Webhook handlers
        GitHubPullRequestHandler,
        {
            provide: 'GITHUB_WEBHOOK_HANDLER',
            useExisting: GitHubPullRequestHandler,
        },
        GitLabMergeRequestHandler,
        {
            provide: 'GITLAB_WEBHOOK_HANDLER',
            useExisting: GitLabMergeRequestHandler,
        },
        BitbucketPullRequestHandler,
        {
            provide: 'BITBUCKET_WEBHOOK_HANDLER',
            useExisting: BitbucketPullRequestHandler,
        },
        AzureReposPullRequestHandler,
        {
            provide: 'AZURE_REPOS_WEBHOOK_HANDLER',
            useExisting: AzureReposPullRequestHandler,
        },
        {
            provide: GET_ADDITIONAL_INFO_HELPER_TOKEN,
            useClass: GetAdditionalInfoHelper,
        },
    ],
    controllers: [CodeManagementController],
    exports: [
        PlatformIntegrationFactory,
        CodeManagementService,
        ReceiveWebhookUseCase,
    ],
})
export class PlatformIntegrationModule implements OnModuleInit {
    constructor(
        private modulesContainer: ModulesContainer,
        private integrationFactory: PlatformIntegrationFactory,
    ) {}

    onModuleInit() {
        const providers = [...this.modulesContainer.values()]
            .map((module) => module.providers)
            .reduce((acc, map) => [...acc, ...map.values()], [])
            .filter((provider) => provider.instance);

        providers.forEach((provider) => {
            const { instance } = provider;
            const integrationMetadata = Reflect.getMetadata(
                'integration',
                instance.constructor,
            );

            if (integrationMetadata) {
                const { type, serviceType } = integrationMetadata;
                if (serviceType === 'codeManagement') {
                    this.integrationFactory.registerCodeManagementService(
                        type,
                        instance as ICodeManagementService,
                    );
                }
            }
        });
    }
}
