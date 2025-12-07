import { FindCodeReviewSettingsLogsUseCase } from '@libs/core/application/use-cases/codeReviewSettingsLog/find-code-review-settings-logs.use-case';
import { RegisterUserStatusLogUseCase } from '@libs/core/application/use-cases/user/register-user-status-log.use-case';
import { CodeReviewSettingsLogModelInstance } from '@libs/core/infrastructure/adapters/repositories/mongoose/schema';
import { CodeReviewSettingLogController } from '@libs/core/infrastructure/http/controllers/codeReviewSettingLog.controller';
import { CODE_REVIEW_SETTINGS_LOG_REPOSITORY_TOKEN } from '@libs/ee/codeReviewSettingsLog/domain/codeReviewSettingsLog/contracts/codeReviewSettingsLog.repository.contract';
import { CODE_REVIEW_SETTINGS_LOG_SERVICE_TOKEN } from '@libs/ee/codeReviewSettingsLog/domain/codeReviewSettingsLog/contracts/codeReviewSettingsLog.service.contract';
import { CodeReviewSettingsLogRepository } from '@libs/ee/codeReviewSettingsLog/repository/codeReviewSettingsLog.repository';
import { CodeReviewConfigLogHandler } from '@libs/ee/codeReviewSettingsLog/services/codeReviewConfigLog.handler';
import { CodeReviewSettingsLogService } from '@libs/ee/codeReviewSettingsLog/services/codeReviewSettingsLog.service';
import { IntegrationLogHandler } from '@libs/ee/codeReviewSettingsLog/services/integrationLog.handler';
import { KodyRulesLogHandler } from '@libs/ee/codeReviewSettingsLog/services/kodyRulesLog.handler';
import { PullRequestMessagesLogHandler } from '@libs/ee/codeReviewSettingsLog/services/pullRequestMessageLog.handler';
import { RepositoriesLogHandler } from '@libs/ee/codeReviewSettingsLog/services/repositoriesLog.handler';
import { UnifiedLogHandler } from '@libs/ee/codeReviewSettingsLog/services/unifiedLog.handler';
import { UserStatusLogHandler } from '@libs/ee/codeReviewSettingsLog/services/userStatusLog.handler';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { GET_ADDITIONAL_INFO_HELPER_TOKEN } from '@libs/shared/domain/contracts/getAdditionalInfo.helper.contract';
import { GetAdditionalInfoHelper } from '@libs/shared/utils/helpers/getAdditionalInfo.helper';
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { TeamsModule } from '@libs/organization/modules/team.module';
import { UsersModule } from '@libs/identity/modules/user.module';

@Module({
    imports: [
        MongooseModule.forFeature([CodeReviewSettingsLogModelInstance]),
        forwardRef(() => PermissionValidationModule),
        forwardRef(() => UsersModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => TeamsModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => UsersModule)
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
        RegisterUserStatusLogUseCase
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
        RegisterUserStatusLogUseCase
    ],
    controllers: [CodeReviewSettingLogController],
})
export class CodeReviewSettingsLogModule {}
