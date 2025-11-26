import { Module, forwardRef } from '@nestjs/common';
import { AuthIntegrationModule } from './authIntegration.module';
import { AutomationModule } from './automation.module';
import { AutomationStrategyModule } from './automationStrategy.module';
import { IntegrationModule } from './integration.module';
import { IntegrationConfigModule } from './integrationConfig.module';
import { PlatformIntegrationModule } from './platformIntegration.module';
import { TeamsModule } from './team.module';
import { TeamAutomationModule } from './teamAutomation.module';

import { OrganizationModule } from './organization.module';

import { CheckIfPRCanBeApprovedCronProvider } from '@/core/infrastructure/adapters/services/cron/CheckIfPRCanBeApproved.cron';
import { CodeReviewFeedbackCronProvider } from '@/core/infrastructure/adapters/services/cron/codeReviewFeedback.cron';
import { KodyLearningCronProvider } from '@/core/infrastructure/adapters/services/cron/kodyLearning.cron';
import { CodebaseModule } from './codeBase.module';
import { KodyRulesModule } from './kodyRules.module';
import { ParametersModule } from './parameters.module';
import { PullRequestMessagesModule } from './pullRequestMessages.module';
import { PullRequestsModule } from './pullRequests.module';

@Module({
    imports: [
        forwardRef(() => TeamsModule),
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => KodyRulesModule),
        forwardRef(() => CodebaseModule),
        PullRequestsModule,
        PullRequestMessagesModule,
        TeamAutomationModule,
        AutomationModule,
        AutomationStrategyModule,
        AuthIntegrationModule,
        IntegrationModule,
        IntegrationConfigModule,
        OrganizationModule,
    ],
    providers: [
        CodeReviewFeedbackCronProvider,
        KodyLearningCronProvider,
        CheckIfPRCanBeApprovedCronProvider,
    ],
    exports: [
        CodeReviewFeedbackCronProvider,
        CheckIfPRCanBeApprovedCronProvider,
    ],
})
export class CronModule {}
