import { CodeReviewSettingsLogService } from '@libs/analytics/ee/settings-log/services/codeReviewSettingsLog.service';
import { IntegrationLogHandler } from '@libs/analytics/ee/settings-log/services/integrationLog.handler';
import { KodyRulesLogHandler } from '@libs/analytics/ee/settings-log/services/kodyRulesLog.handler';
import { PullRequestMessagesLogHandler } from '@libs/analytics/ee/settings-log/services/pullRequestMessageLog.handler';
import { RepositoriesLogHandler } from '@libs/analytics/ee/settings-log/services/repositoriesLog.handler';
import { UnifiedLogHandler } from '@libs/analytics/ee/settings-log/services/unifiedLog.handler';
import { UserStatusLogHandler } from '@libs/analytics/ee/settings-log/services/userStatusLog.handler';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { GET_ADDITIONAL_INFO_HELPER_TOKEN } from '@libs/core/domain/contracts/getAdditionalInfo.helper.contract';
import { GetAdditionalInfoHelper } from '@libs/core/utils/helpers/getAdditionalInfo.helper';
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { TeamsModule } from '@libs/organization/modules/team.module';
import { UsersModule } from '@libs/identity/modules/user.module';
import { FindCodeReviewSettingsLogsUseCase } from '@libs/analytics/application/use-cases/find-code-review-settings-logs.use-case';
import { CodeReviewSettingsLogModelInstance } from '@libs/core/infrastructure/database/mongoose/schemas';
import { CODE_REVIEW_SETTINGS_LOG_REPOSITORY_TOKEN } from '@libs/analytics/ee/settings-log/domain/codeReviewSettingsLog/contracts/codeReviewSettingsLog.repository.contract';
import { CodeReviewSettingsLogRepository } from '@libs/analytics/ee/settings-log/repository/codeReviewSettingsLog.repository';
import { CODE_REVIEW_SETTINGS_LOG_SERVICE_TOKEN } from '@libs/analytics/ee/settings-log/domain/codeReviewSettingsLog/contracts/codeReviewSettingsLog.service.contract';
import { CodeReviewConfigLogHandler } from '@libs/analytics/ee/settings-log/services/codeReviewConfigLog.handler';
import { RegisterUserStatusLogUseCase } from '@libs/identity/application/use-cases/user/register-user-status-log.use-case';
import { CodeReviewSettingLogController } from 'apps/api/src/controllers/codeReviewSettingLog.controller';

@Module({
    imports: [
        MongooseModule.forFeature([CodeReviewSettingsLogModelInstance]),
        forwardRef(() => PermissionValidationModule),
        forwardRef(() => UsersModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => TeamsModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => UsersModule),
    ],
    providers: [
        {
            provide: CODE_REVIEW_SETTINGS_LOG_REPOSITORY_TOKEN,
            useClass: CodeReviewSettingsLogRepository,
        },
        {
            provide: CODE_REVIEW_SETTINGS_LOG_SERVICE_TOKEN,
            useClass: CodeReviewSettingsLogService,
        },
        UnifiedLogHandler,
        CodeReviewConfigLogHandler,
        RepositoriesLogHandler,
        KodyRulesLogHandler,
        IntegrationLogHandler,
        UserStatusLogHandler,
        PullRequestMessagesLogHandler,
        FindCodeReviewSettingsLogsUseCase,
        {
            provide: GET_ADDITIONAL_INFO_HELPER_TOKEN,
            useClass: GetAdditionalInfoHelper,
        },
        RegisterUserStatusLogUseCase,
    ],
    exports: [
        CODE_REVIEW_SETTINGS_LOG_REPOSITORY_TOKEN,
        CODE_REVIEW_SETTINGS_LOG_SERVICE_TOKEN,
        UnifiedLogHandler,
        CodeReviewConfigLogHandler,
        RepositoriesLogHandler,
        KodyRulesLogHandler,
        FindCodeReviewSettingsLogsUseCase,
        IntegrationLogHandler,
        UserStatusLogHandler,
        PullRequestMessagesLogHandler,
        GET_ADDITIONAL_INFO_HELPER_TOKEN,
        RegisterUserStatusLogUseCase,
    ],
    controllers: [CodeReviewSettingLogController],
})
export class CodeReviewSettingsLogModule {}
