import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PromptService } from '@libs/agents/infrastructure/services/prompt.service';
import { CODE_REVIEW_FEEDBACK_REPOSITORY_TOKEN } from '@libs/code-review/domain/codeReviewFeedback/contracts/codeReviewFeedback.repository.contract';
import { CODE_REVIEW_FEEDBACK_SERVICE_TOKEN } from '@libs/code-review/domain/codeReviewFeedback/contracts/codeReviewFeedback.service.contract';
import { CodeReviewFeedbackRepository } from '@libs/code-review/infrastructure/repositories/codeReviewFeedback.repository';
import { CodeReviewFeedbackService } from '@libs/code-review/infrastructure/services/code-review-feedback.service';

import { CodeReviewFeedbackModelInstance } from '@libs/core/infrastructure/database/mongoose/schemas';
import { UserCoreModule } from '@libs/identity/modules/user-core.module';
import { IntegrationCoreModule } from '@libs/integrations/modules/integrations-core.module';
import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { ParametersCoreModule } from '@libs/organization/modules/parameters-core.module';
import { TeamCoreModule } from '@libs/organization/modules/team-core.module';
import { OrganizationCoreModule } from '@libs/organization/modules/organization-core.module';
import { GithubModule } from '@libs/platform/modules/github.module';
import { GitlabModule } from '@libs/platform/modules/gitlab.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';

import { PullRequestsCoreModule } from './pull-requests-core.module';
import { GetReactionsUseCase } from '../application/use-cases/codeReviewFeedback/get-reactions.use-case';
import { SaveCodeReviewFeedbackUseCase } from '../application/use-cases/codeReviewFeedback/save-feedback.use-case';

const UseCases = [GetReactionsUseCase, SaveCodeReviewFeedbackUseCase] as const;

@Module({
    imports: [
        MongooseModule.forFeature([CodeReviewFeedbackModelInstance]),
        forwardRef(() => TeamCoreModule),
        forwardRef(() => OrganizationCoreModule),
        forwardRef(() => UserCoreModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => IntegrationCoreModule),
        forwardRef(() => IntegrationConfigCoreModule),
        forwardRef(() => ParametersCoreModule),
        forwardRef(() => GithubModule),
        forwardRef(() => GitlabModule),
        forwardRef(() => PullRequestsCoreModule),
    ],
    providers: [
        ...UseCases,
        PromptService,
        {
            provide: CODE_REVIEW_FEEDBACK_REPOSITORY_TOKEN,
            useClass: CodeReviewFeedbackRepository,
        },
        {
            provide: CODE_REVIEW_FEEDBACK_SERVICE_TOKEN,
            useClass: CodeReviewFeedbackService,
        },
    ],
    exports: [
        CODE_REVIEW_FEEDBACK_REPOSITORY_TOKEN,
        CODE_REVIEW_FEEDBACK_SERVICE_TOKEN,
        ...UseCases,
    ],
    controllers: [],
})
export class CodeReviewFeedbackModule {}
