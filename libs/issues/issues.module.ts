import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Domain
import { ISSUES_REPOSITORY_TOKEN } from '@libs/domain/contracts/issues.repository';
import { ISSUES_SERVICE_TOKEN } from '@libs/domain/contracts/issues.service.contract';

// Application - Use Cases
import { GenerateIssuesFromPrClosedUseCase } from '@libs/application/use-cases/generate-issues-from-pr-closed.use-case';
import { GetIssueByIdUseCase } from '@libs/application/use-cases/get-issue-by-id.use-case';
import { GetIssuesUseCase } from '@libs/application/use-cases/get-issues.use-case';
import { GetTotalIssuesUseCase } from '@libs/application/use-cases/get-total-issues.use-case';
import { UpdateIssuePropertyUseCase } from '@libs/application/use-cases/update-issue-property.use-case';

// Infrastructure
import { IssuesService } from '@libs/infrastructure/issues.service';

// External dependencies (from src/ - temporary during migration)
import { IssuesRepository } from '@libs/core/infrastructure/database/mongoose/repositories/issues.repository';
import {
    IssuesModel,
    IssuesSchema,
} from '@libs/core/infrastructure/database/mongoose/schemas/issues.model';
import { KODY_ISSUES_MANAGEMENT_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/KodyIssuesManagement.contract';
import { KodyIssuesManagementService } from '@libs/issues/infrastructure/adapters/service/kodyIssuesManagement.service';
import {
    KODY_ISSUES_ANALYSIS_SERVICE_TOKEN,
    KodyIssuesAnalysisService,
} from '@libs/code-review/ee/analysis/kodyIssuesAnalysis.service';
import { IssuesController } from '@apps/api/controllers/issues.controller';

// Module dependencies (still from src/modules/ during migration)
import { GlobalCacheModule } from '@libs/core/cache/cache.module';
import { CodebaseModule } from '@libs/code-review/code-review.module';
import { CodeReviewFeedbackModule } from '@libs/code-review/code-review.module';
import { IntegrationConfigModule } from '@libs/integrations/integrations.module';
import { OrganizationModule } from '@libs/organization/organization.module';
import { OrganizationParametersModule } from '@libs/organization/organization.module';
import { ParametersModule } from '@libs/organization/organization.module';
import { PullRequestsModule } from '@libs/code-review/code-review.module';
import { UsersModule } from '@libs/identity/identity.module';
import { LicenseModule } from '@libs/ee/license/license.module';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';

const UseCases = [
    UpdateIssuePropertyUseCase,
    GenerateIssuesFromPrClosedUseCase,
    GetTotalIssuesUseCase,
    GetIssuesUseCase,
    GetIssueByIdUseCase,
] as const;

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: IssuesModel.name,
                schema: IssuesSchema,
            },
        ]),
        forwardRef(() => PullRequestsModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => CodeReviewFeedbackModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => UsersModule),
        forwardRef(() => OrganizationModule),
        GlobalCacheModule,
        forwardRef(() => LicenseModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => PermissionValidationModule),
    ],
    providers: [
        ...UseCases,

        {
            provide: ISSUES_REPOSITORY_TOKEN,
            useClass: IssuesRepository,
        },
        {
            provide: ISSUES_SERVICE_TOKEN,
            useClass: IssuesService,
        },
        {
            provide: KODY_ISSUES_MANAGEMENT_SERVICE_TOKEN,
            useClass: KodyIssuesManagementService,
        },
        {
            provide: KODY_ISSUES_ANALYSIS_SERVICE_TOKEN,
            useClass: KodyIssuesAnalysisService,
        },
    ],
    controllers: [IssuesController],
    exports: [
        ISSUES_REPOSITORY_TOKEN,
        ISSUES_SERVICE_TOKEN,
        KODY_ISSUES_MANAGEMENT_SERVICE_TOKEN,
        KODY_ISSUES_ANALYSIS_SERVICE_TOKEN,
        ...UseCases,
    ],
})
export class IssuesModule {}
