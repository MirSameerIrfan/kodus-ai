import { McpModule } from '@/core/infrastructure/adapters/mcp/mcp.module';
import { JwtAuthGuard } from '@/core/infrastructure/adapters/services/auth/jwt-auth.guard';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { FileReviewModule } from '@/ee/codeReview/fileReviewContextPreparation/fileReview.module';
import { KodyASTModule } from '@/ee/kodyAST/kodyAST.module';
import { KodyASTAnalyzeContextModule } from '@/ee/kodyASTAnalyze/kodyAstAnalyzeContext.module';
import { LicenseModule } from '@/ee/license/license.module';
import { PermissionValidationModule } from '@/ee/shared/permission-validation.module';
import { GithubModule } from '@/modules/github.module';
import { InteractionModule } from '@/modules/interaction.module';
import { ProfilesModule } from '@/modules/profiles.module';
import { UsersModule } from '@/modules/user.module';
import { LLMModule } from '@kodus/kodus-common/llm';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AgentModule } from './agent.module';
import { AuthModule } from './auth.module';
import { AuthIntegrationModule } from './authIntegration.module';
import { AutomationModule } from './automation.module';
import { AutomationStrategyModule } from './automationStrategy.module';
import { BitbucketModule } from './bitbucket.module';
import { GlobalCacheModule } from './cache.module';
import { CodebaseModule } from './codeBase.module';
import { CodeReviewExecutionModule } from './codeReviewExecution.module';
import { CronModule } from './cron.module';
import { DatabaseModule } from './database.module';
import { DryRunModule } from './dryRun.module';
import { GitlabModule } from './gitlab.module';
import { GlobalParametersModule } from './global-parameters.module';
import { HealthModule } from './health.module';
import { IntegrationModule } from './integration.module';
import { IntegrationConfigModule } from './integrationConfig.module';
import { IssuesModule } from './issues.module';
import { KodyRulesModule } from './kodyRules.module';
import { LogModule } from './log.module';
import { MSTeamsModule } from './msTeams.module';
import { OrganizationModule } from './organization.module';
import { OrganizationAutomationModule } from './organizationAutomation.module';
import { OrganizationParametersModule } from './organizationParameters.module';
import { ParametersModule } from './parameters.module';
import { PermissionsModule } from './permissions.module';
import { PlatformIntegrationModule } from './platformIntegration.module';
import { ProfileConfigModule } from './profileConfig.module';
import { PullRequestMessagesModule } from './pullRequestMessages.module';
import { RabbitMQWrapperModule } from './rabbitmq.module';
import { RuleLikeModule } from './ruleLike.module';
import { SegmentModule } from './segment.module';
import { SharedModule } from './shared.module';
import { SuggestionEmbeddedModule } from './suggestionEmbedded.module';
import { TeamsModule } from './team.module';
import { TeamAutomationModule } from './teamAutomation.module';
import { TeamMembersModule } from './teamMembers.module';
import { TokenChunkingModule } from './tokenChunking.module';
import { UsageModule } from './usage.module';
import { WebhookLogModule } from './webhookLog.module';

@Module({
    imports: [
        EventEmitterModule.forRoot(),
        McpModule.forRoot(),
        GlobalCacheModule,
        RabbitMQWrapperModule.register(),
        ScheduleModule.forRoot(),
        KodyASTModule,
        PlatformIntegrationModule,
        LogModule,
        CronModule,
        DatabaseModule,
        SharedModule,
        AuthModule,
        UsersModule,
        TeamMembersModule,
        GithubModule,
        GitlabModule,
        OrganizationModule,
        HealthModule,
        ProfilesModule,
        TeamsModule,
        AutomationModule,
        TeamAutomationModule,
        AutomationStrategyModule,
        AgentModule,
        AuthIntegrationModule,
        IntegrationModule,
        IntegrationConfigModule,
        MSTeamsModule,
        InteractionModule,
        ProfileConfigModule,
        ParametersModule,
        OrganizationParametersModule,
        OrganizationAutomationModule,
        CodebaseModule,
        SegmentModule,
        KodyRulesModule,
        BitbucketModule,
        SuggestionEmbeddedModule,
        FileReviewModule,
        KodyASTAnalyzeContextModule,
        GlobalParametersModule,
        LicenseModule,
        RuleLikeModule,
        IssuesModule,
        TokenChunkingModule,
        PullRequestMessagesModule,
        LLMModule.forRoot({
            logger: PinoLoggerService,
            global: true,
        }),
        CodeReviewExecutionModule,
        PermissionsModule,
        WebhookLogModule,
        PermissionValidationModule,
        UsageModule,
        DryRunModule,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
    ],
})
export class AppModule {}
