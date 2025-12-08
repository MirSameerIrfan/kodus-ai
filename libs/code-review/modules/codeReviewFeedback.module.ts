import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GithubModule } from '@libs/platform/modules/github.module';
import { GitlabModule } from '@libs/platform/modules/gitlab.module';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { OrganizationModule } from '@libs/organization/organization.module';
import { PlatformIntegrationModule } from '@libs/platform/platform.module';
import { TeamsModule } from '@libs/organization/modules/team.module';
import { UsersModule } from '@libs/identity/modules/user.module';
import { GetReactionsUseCase } from '../application/use-cases/feedback/get-reactions.use-case';
import { SaveCodeReviewFeedbackUseCase } from '../application/use-cases/feedback/save-feedback.use-case';
import { CodeReviewFeedbackModelInstance } from '@core/database/mongoose/schemas';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { PullRequestsModule } from './pull-requests.module';

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
