import { PullRequestMessagesUseCases } from '@/core/application/use-cases/pullRequestMessages';
import { PULL_REQUEST_MESSAGES_REPOSITORY_TOKEN } from '@/core/domain/pullRequestMessages/contracts/pullRequestMessages.repository.contract';
import { PULL_REQUEST_MESSAGES_SERVICE_TOKEN } from '@/core/domain/pullRequestMessages/contracts/pullRequestMessages.service.contract';
import { PullRequestMessagesRepository } from '@/core/infrastructure/adapters/repositories/mongoose/pullRequestMessages.repository';
import { PullRequestMessagesModelInstance } from '@/core/infrastructure/adapters/repositories/mongoose/schema';
import { PullRequestMessagesService } from '@/core/infrastructure/adapters/services/pullRequestMessages/pullRequestMessages.service';
import { PullRequestMessagesController } from '@/core/infrastructure/http/controllers/pullRequestMessages.controller';
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CodeReviewSettingsLogModule } from './codeReviewSettingsLog.module';
import { CODE_REVIEW_SETTINGS_LOG_SERVICE_TOKEN } from '@/ee/codeReviewSettingsLog/domain/codeReviewSettingsLog/contracts/codeReviewSettingsLog.service.contract';
import { CodeReviewSettingsLogService } from '@/ee/codeReviewSettingsLog/services/codeReviewSettingsLog.service';
import { GetAdditionalInfoHelper } from '@/shared/utils/helpers/getAdditionalInfo.helper';
import { GET_ADDITIONAL_INFO_HELPER_TOKEN } from '@/shared/domain/contracts/getAdditionalInfo.helper.contract';
import { IntegrationModule } from './integration.module';
import { IntegrationConfigModule } from './integrationConfig.module';
import { ParametersModule } from './parameters.module';
import { DeleteByRepositoryOrDirectoryPullRequestMessagesUseCase } from '@/core/application/use-cases/pullRequestMessages/delete-by-repository-or-directory.use-case';

@Module({
    imports: [
        MongooseModule.forFeature([PullRequestMessagesModelInstance]),
        forwardRef(() => CodeReviewSettingsLogModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => ParametersModule),
    ],
    providers: [
        {
            provide: PULL_REQUEST_MESSAGES_REPOSITORY_TOKEN,
            useClass: PullRequestMessagesRepository,
        },
        {
            provide: PULL_REQUEST_MESSAGES_SERVICE_TOKEN,
            useClass: PullRequestMessagesService,
        },
        // {
        //     provide: CODE_REVIEW_SETTINGS_LOG_SERVICE_TOKEN,
        //     useClass: CodeReviewSettingsLogService,
        // },
        {
            provide: GET_ADDITIONAL_INFO_HELPER_TOKEN,
            useClass: GetAdditionalInfoHelper,
        },
        ...PullRequestMessagesUseCases,
    ],
    exports: [
        PULL_REQUEST_MESSAGES_REPOSITORY_TOKEN,
        PULL_REQUEST_MESSAGES_SERVICE_TOKEN,
        // CODE_REVIEW_SETTINGS_LOG_SERVICE_TOKEN,
        DeleteByRepositoryOrDirectoryPullRequestMessagesUseCase,
    ],
    controllers: [PullRequestMessagesController],
})
export class PullRequestMessagesModule {}
