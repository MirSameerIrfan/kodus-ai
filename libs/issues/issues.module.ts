import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Domain
import { ISSUES_REPOSITORY_TOKEN } from './domain/contracts/issues.repository';
import { ISSUES_SERVICE_TOKEN } from './domain/contracts/issues.service.contract';

// Application - Use Cases
import { GenerateIssuesFromPrClosedUseCase } from './application/use-cases/generate-issues-from-pr-closed.use-case';
import { GetIssueByIdUseCase } from './application/use-cases/get-issue-by-id.use-case';
import { GetIssuesUseCase } from './application/use-cases/get-issues.use-case';
import { GetTotalIssuesUseCase } from './application/use-cases/get-total-issues.use-case';
import { UpdateIssuePropertyUseCase } from './application/use-cases/update-issue-property.use-case';

// Infrastructure
import { IssuesService } from './infrastructure/issues.service';

// External dependencies (from src/ - temporary during migration)
import { IssuesRepository } from '@/core/infrastructure/adapters/repositories/mongoose/issues.repository';
import {
    IssuesModel,
    IssuesSchema,
} from '@/core/infrastructure/adapters/repositories/mongoose/schema/issues.model';
import { KODY_ISSUES_MANAGEMENT_SERVICE_TOKEN } from '@/core/domain/codeBase/contracts/KodyIssuesManagement.contract';
import { KodyIssuesManagementService } from '@/core/infrastructure/adapters/services/kodyIssuesManagement/service/kodyIssuesManagement.service';
import {
    KODY_ISSUES_ANALYSIS_SERVICE_TOKEN,
    KodyIssuesAnalysisService,
} from '@/ee/codeBase/kodyIssuesAnalysis.service';
import { IssuesController } from '@/core/infrastructure/http/controllers/issues.controller';

// Module dependencies (still from src/modules/ during migration)
import { GlobalCacheModule } from '@/modules/cache.module';
import { CodebaseModule } from '@/modules/codeBase.module';
import { CodeReviewFeedbackModule } from '@/modules/codeReviewFeedback.module';
import { IntegrationConfigModule } from '@/modules/integrationConfig.module';
import { OrganizationModule } from '@/modules/organization.module';
import { OrganizationParametersModule } from '@/modules/organizationParameters.module';
import { ParametersModule } from '@/modules/parameters.module';
import { PullRequestsModule } from '@/modules/pullRequests.module';
import { UsersModule } from '@/modules/user.module';
import { LicenseModule } from '@/ee/license/license.module';
import { PermissionValidationModule } from '@/ee/shared/permission-validation.module';

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
