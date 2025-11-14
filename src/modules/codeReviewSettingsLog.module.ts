import { FindCodeReviewSettingsLogsUseCase } from '@/core/application/use-cases/codeReviewSettingsLog/find-code-review-settings-logs.use-case';
import { CodeReviewSettingsLogModelInstance } from '@/core/infrastructure/adapters/repositories/mongoose/schema';
import { CodeReviewSettingLogController } from '@/core/infrastructure/http/controllers/codeReviewSettingLog.controller';
import { CODE_REVIEW_SETTINGS_LOG_REPOSITORY_TOKEN } from '@/ee/codeReviewSettingsLog/domain/codeReviewSettingsLog/contracts/codeReviewSettingsLog.repository.contract';
import { CODE_REVIEW_SETTINGS_LOG_SERVICE_TOKEN } from '@/ee/codeReviewSettingsLog/domain/codeReviewSettingsLog/contracts/codeReviewSettingsLog.service.contract';
import { CodeReviewSettingsLogRepository } from '@/ee/codeReviewSettingsLog/repository/codeReviewSettingsLog.repository';
import { CodeReviewConfigLogHandler } from '@/ee/codeReviewSettingsLog/services/codeReviewConfigLog.handler';
import { CodeReviewSettingsLogService } from '@/ee/codeReviewSettingsLog/services/codeReviewSettingsLog.service';
import { IntegrationLogHandler } from '@/ee/codeReviewSettingsLog/services/integrationLog.handler';
import { KodyRulesLogHandler } from '@/ee/codeReviewSettingsLog/services/kodyRulesLog.handler';
import { PullRequestMessagesLogHandler } from '@/ee/codeReviewSettingsLog/services/pullRequestMessageLog.handler';
import { RepositoriesLogHandler } from '@/ee/codeReviewSettingsLog/services/repositoriesLog.handler';
import { UnifiedLogHandler } from '@/ee/codeReviewSettingsLog/services/unifiedLog.handler';
import { UserStatusLogHandler } from '@/ee/codeReviewSettingsLog/services/userStatusLog.handler';
import { PermissionValidationModule } from '@/ee/shared/permission-validation.module';
import { GET_ADDITIONAL_INFO_HELPER_TOKEN } from '@/shared/domain/contracts/getAdditionalInfo.helper.contract';
import { GetAdditionalInfoHelper } from '@/shared/utils/helpers/getAdditionalInfo.helper';
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationModule } from './integration.module';
import { IntegrationConfigModule } from './integrationConfig.module';
import { ParametersModule } from './parameters.module';
import { TeamsModule } from './team.module';
import { UsersModule } from './user.module';

@Module({
    imports: [
        MongooseModule.forFeature([CodeReviewSettingsLogModelInstance]),
        PermissionValidationModule,
        forwardRef(() => UsersModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => TeamsModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => IntegrationModule),
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
    ],
    controllers: [CodeReviewSettingLogController],
})
export class CodeReviewSettingsLogModule {}
