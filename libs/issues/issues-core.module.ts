import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UseCases } from './application/use-cases';
import { IssuesRepository } from './infrastructure/adapters/repositories/issues.repository';
import { ISSUES_REPOSITORY_TOKEN } from './domain/contracts/issues.repository';
import { ISSUES_SERVICE_TOKEN } from './domain/contracts/issues.service.contract';
import { KodyIssuesManagementService } from './infrastructure/adapters/service/kodyIssuesManagement.service';
import {
    KODY_ISSUES_ANALYSIS_SERVICE_TOKEN,
    KodyIssuesAnalysisService,
} from '@libs/ee/codeBase/kodyIssuesAnalysis.service';
import { KODY_ISSUES_MANAGEMENT_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/KodyIssuesManagement.contract';
import {
    IssuesModel,
    IssuesSchema,
} from './infrastructure/adapters/repositories/schemas/issues.model';
import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { ParametersCoreModule } from '@libs/organization/modules/parameters-core.module';
import { CodeReviewFeedbackModule } from '@libs/code-review/modules/codeReviewFeedback.module';
import { CodebaseModule } from '@libs/code-review/code-review.module';
import { UserCoreModule } from '@libs/identity/modules/user-core.module';
import { OrganizationCoreModule } from '@libs/organization/modules/organization-core.module';
import { GlobalCacheModule } from '@libs/core/cache/cache.module';
import { LicenseModule } from '@libs/ee/license/license.module';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { IssuesService } from './infrastructure/adapters/service/issues.service';

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
        forwardRef(() => ParametersCoreModule),
        forwardRef(() => CodeReviewFeedbackModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => UserCoreModule),
        forwardRef(() => OrganizationCoreModule),
        GlobalCacheModule,
        forwardRef(() => LicenseModule),
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
    exports: [
        ISSUES_REPOSITORY_TOKEN,
        ISSUES_SERVICE_TOKEN,
        KODY_ISSUES_MANAGEMENT_SERVICE_TOKEN,
        KODY_ISSUES_ANALYSIS_SERVICE_TOKEN,
        ...UseCases,
    ],
})
export class IssuesCoreModule {}
