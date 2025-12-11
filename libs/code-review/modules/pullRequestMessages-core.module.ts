import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DeleteByRepositoryOrDirectoryPullRequestMessagesUseCase } from '../application/use-cases/pullRequestMessages/delete-by-repository-or-directory.use-case';
import { PULL_REQUEST_MESSAGES_REPOSITORY_TOKEN } from '../domain/pullRequestMessages/contracts/pullRequestMessages.repository.contract';
import { PullRequestMessagesRepository } from '../infrastructure/adapters/repositories/pullRequestMessages.repository';
import { PullRequestMessagesService } from '../infrastructure/adapters/services/pullRequestMessages.service';
import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { IntegrationCoreModule } from '@libs/integrations/modules/integrations-core.module';
import { ParametersCoreModule } from '@libs/organization/modules/parameters-core.module';
import { PULL_REQUEST_MESSAGES_SERVICE_TOKEN } from '../domain/pullRequestMessages/contracts/pullRequestMessages.service.contract';
import { GET_ADDITIONAL_INFO_HELPER_TOKEN } from '@libs/core/domain/contracts';
import { GetAdditionalInfoHelper } from '@libs/common/utils/helpers/getAdditionalInfo.helper';

@Module({
    imports: [
        MongooseModule.forFeature([PullRequestMessagesModelInstance]),
        forwardRef(() => CodeReviewSettingsLogModule),
        forwardRef(() => IntegrationCoreModule),
        forwardRef(() => IntegrationConfigCoreModule),
        forwardRef(() => ParametersCoreModule),
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
        {
            provide: GET_ADDITIONAL_INFO_HELPER_TOKEN,
            useClass: GetAdditionalInfoHelper,
        },
        ...PullRequestMessagesUseCases,
    ],
    exports: [
        PULL_REQUEST_MESSAGES_REPOSITORY_TOKEN,
        PULL_REQUEST_MESSAGES_SERVICE_TOKEN,
        DeleteByRepositoryOrDirectoryPullRequestMessagesUseCase,
    ],
})
export class PullRequestMessagesCoreModule {}
