import { GetReactionsUseCase } from '@libs/core/application/use-cases/codeReviewFeedback/get-reactions.use-case';
import { SaveCodeReviewFeedbackUseCase } from '@libs/core/application/use-cases/codeReviewFeedback/save-feedback.use-case';
import { CODE_REVIEW_FEEDBACK_REPOSITORY_TOKEN } from '@libs/core/domain/codeReviewFeedback/contracts/codeReviewFeedback.repository';
import { CODE_REVIEW_FEEDBACK_SERVICE_TOKEN } from '@libs/core/domain/codeReviewFeedback/contracts/codeReviewFeedback.service.contract';
import { CodeReviewFeedbackRepository } from '@libs/core/infrastructure/adapters/repositories/mongoose/codeReviewFeedback.repository';
import { CodeReviewFeedbackModelInstance } from '@libs/core/infrastructure/adapters/repositories/mongoose/schema';
import { CodeReviewFeedbackService } from '@libs/core/infrastructure/adapters/services/codeReviewFeedback/codeReviewFeedback.service';
import { PromptService } from '@libs/core/infrastructure/adapters/services/prompt.service';
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GithubModule } from '@libs/platform/modules/github.module';
import { GitlabModule } from '@libs/platform/modules/gitlab.module';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { OrganizationModule } from '@libs/organization/organization.module';
import { ParametersModule } from '@libs/parameters.module';
import { PlatformIntegrationModule } from '@libs/platform/platform.module';
import { PullRequestsModule } from '@libs/pullRequests.module';
import { TeamsModule } from '@libs/organization/modules/team.module';
import { UsersModule } from '@libs/identity/modules/user.module';

const UseCases = [GetReactionsUseCase, SaveCodeReviewFeedbackUseCase] as const;

@Module({
    imports: [
        MongooseModule.forFeature([CodeReviewFeedbackModelInstance]),
        forwardRef(() => TeamsModule),
        forwardRef(() => OrganizationModule),
        forwardRef(() => UsersModule),
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => GithubModule),
        forwardRef(() => GitlabModule),
        forwardRef(() => PullRequestsModule),
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
