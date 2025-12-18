import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AutomationModule } from '@libs/automation/modules/automation.module';
import { RabbitMQWrapperModule } from '@libs/core/infrastructure/queue/rabbitmq.module';
import { IntegrationModule } from '@libs/integrations/modules/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';

import { GenerateKodyRulesUseCase } from '@libs/kodyRules/application/use-cases/generate-kody-rules.use-case';
import { KodyRulesModule } from '@libs/kodyRules/modules/kodyRules.module';

import { CheckIfPRCanBeApprovedCronProvider } from './CheckIfPRCanBeApproved.cron';
import { CodeReviewFeedbackCronProvider } from './codeReviewFeedback.cron';
import { KodyLearningCronProvider } from './kodyLearning.cron';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';
import { CodeReviewConfigurationModule } from '@libs/code-review/modules/code-review-configuration.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';
import { TeamModule } from '@libs/organization/modules/team.module';
import { PullRequestMessagesModule } from '@libs/code-review/modules/pullRequestMessages.module';
import { CodebaseModule } from '@libs/code-review/modules/codebase.module';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        RabbitMQWrapperModule.register({
            enableConsumers: false,
        }),
        AutomationModule,
        ParametersModule,
        TeamModule,
        PullRequestsModule,
        CodeReviewConfigurationModule,
        PlatformModule,
        PullRequestMessagesModule,
        KodyRulesModule,
        CodebaseModule,
        IntegrationModule,
        IntegrationConfigModule,
    ],
    providers: [
        CheckIfPRCanBeApprovedCronProvider,
        CodeReviewFeedbackCronProvider,
        KodyLearningCronProvider,
        GenerateKodyRulesUseCase,
    ],
})
export class CronModule {}
