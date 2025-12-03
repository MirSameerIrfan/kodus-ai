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
import { WorkflowQueueModule } from './workflowQueue.module';

/**
 * AppModule - Base Shared Module
 * 
 * This module contains all shared infrastructure that is used by:
 * - ApiModule (API REST - porta 3331)
 * - WebhookHandlerModule (Webhook Handler - porta 3332)
 * - WorkerModule (Workers - sem HTTP)
 * 
 * It includes:
 * - Database connections (PostgreSQL, MongoDB)
 * - RabbitMQ configuration
 * - Logging and observability
 * - All domain modules (users, organizations, teams, etc.)
 * - Business logic modules (automation, codebase, etc.)
 * 
 * NO HTTP controllers are included here - they are added by specific modules.
 * NO APP_GUARD is included here - authentication is handled by specific modules.
 */
@Module({
    imports: [
        // Infrastructure
        EventEmitterModule.forRoot(),
        McpModule.forRoot(),
        GlobalCacheModule,
        RabbitMQWrapperModule.register(),
        ScheduleModule.forRoot(),
        LogModule,
        DatabaseModule,
        SharedModule,
        // Domain Modules
        AuthModule,
        UsersModule,
        TeamMembersModule,
        OrganizationModule,
        ProfilesModule,
        TeamsModule,
        // Platform Integration
        PlatformIntegrationModule,
        GithubModule,
        GitlabModule,
        BitbucketModule,
        // Automation & Code Review
        AutomationModule,
        TeamAutomationModule,
        AutomationStrategyModule,
        CodebaseModule,
        CodeReviewExecutionModule,
        KodyASTModule,
        KodyASTAnalyzeContextModule,
        FileReviewModule,
        // Other Modules
        AgentModule,
        AuthIntegrationModule,
        IntegrationModule,
        IntegrationConfigModule,
        MSTeamsModule,
        InteractionModule,
        ProfileConfigModule,
        ParametersModule,
        OrganizationParametersModule,
        SegmentModule,
        KodyRulesModule,
        SuggestionEmbeddedModule,
        GlobalParametersModule,
        LicenseModule,
        RuleLikeModule,
        IssuesModule,
        TokenChunkingModule,
        PullRequestMessagesModule,
        PermissionsModule,
        WebhookLogModule,
        PermissionValidationModule,
        UsageModule,
        DryRunModule,
        CronModule,
        HealthModule,
        // LLM Module
        LLMModule.forRoot({
            logger: PinoLoggerService,
            global: true,
        }),
        // Workflow Queue Module (shared infrastructure, not workers)
        // Workers are added by WorkerModule
        WorkflowQueueModule,
    ],
    // No APP_GUARD here - authentication is handled by ApiModule
    // No controllers here - controllers are added by ApiModule and WebhookHandlerModule
})
export class AppModule {}

