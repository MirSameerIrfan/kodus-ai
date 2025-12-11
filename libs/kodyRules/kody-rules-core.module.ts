import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CodeReviewSettingsLogModule } from '@libs/analytics/modules/settings-log.module';
import { UseCases } from './application/use-cases';
import { ChangeStatusKodyRulesUseCase } from './application/use-cases/change-status-kody-rules.use-case';
import { CreateOrUpdateKodyRulesUseCase } from './application/use-cases/create-or-update.use-case';
import { FindRulesInOrganizationByRuleFilterKodyRulesUseCase } from './application/use-cases/find-rules-in-organization-by-filter.use-case';
import { GenerateKodyRulesUseCase } from './application/use-cases/generate-kody-rules.use-case';
import { SendRulesNotificationUseCase } from './application/use-cases/send-rules-notification.use-case';
import { SyncSelectedRepositoriesKodyRulesUseCase } from './application/use-cases/sync-selected-repositories.use-case';
import { GlobalCacheModule } from '@libs/core/cache/cache.module';
import { CodebaseModule } from '@libs/code-review/code-review.module';
import { ContextReferenceModule } from '@libs/code-review/modules/contextReference.module';
import { PromptsModule } from '@libs/code-review/modules/prompts.module';
import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';
import { KODY_RULES_REPOSITORY_TOKEN } from './domain/contracts/kodyRules.repository.contract';
import { KODY_RULES_SERVICE_TOKEN } from './domain/contracts/kodyRules.service.contract';
import { KodyRulesSyncService } from './infrastructure/adapters/services/kodyRulesSync.service';
import { KodyRulesValidationModule } from '@libs/ee/kodyRules/kody-rules-validation.module';
import { KodyRulesRepository } from '@libs/ee/kodyRules/repository/kodyRules.repository';
import { KodyRulesValidationService } from '@libs/ee/kodyRules/service/kody-rules-validation.service';
import { KodyRulesService } from '@libs/ee/kodyRules/service/kodyRules.service';
import { LicenseModule } from '@libs/ee/license/license.module';
import { LicenseService } from '@libs/ee/license/license.service';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { GET_ADDITIONAL_INFO_HELPER_TOKEN } from '@libs/shared/domain/contracts/getAdditionalInfo.helper.contract';
import { GetAdditionalInfoHelper } from '@libs/shared/utils/helpers/getAdditionalInfo.helper';

import { IntegrationModule } from '@libs/integrations/modules/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { OrganizationCoreModule } from '@libs/organization/modules/organization-core.module';
// import { OrganizationParametersModule } from '@libs/organization/modules/org-parameters.module';
import { ParametersCoreModule } from '@libs/organization/modules/parameters-core.module';
import { PlatformIntegrationModule } from '@libs/platform/modules/platform.module';
import { RuleLikeModule } from '@libs/ruleLike.module'; // This path looks suspicious too, but I wont touch it blindly.
import { UserCoreModule } from '@libs/identity/modules/user-core.module';
import {
    KodyRulesModel,
    KodyRulesSchema,
} from './infrastructure/adapters/repositories/schemas/kodyRules.model';
import { ExternalReferenceLoaderService } from './infrastructure/adapters/services/externalReferenceLoader.service';
import { KodyRuleDependencyService } from './infrastructure/adapters/services/kodyRulesDependency.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: KodyRulesModel.name,
                schema: KodyRulesSchema,
            },
        ]),
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => ParametersCoreModule),
        forwardRef(() => UserCoreModule),
        forwardRef(() => OrganizationCoreModule),
        forwardRef(() => CodeReviewSettingsLogModule),
        forwardRef(() => RuleLikeModule),
        forwardRef(() => LicenseModule),
        // forwardRef(() => OrganizationParametersModule),
        forwardRef(() => PullRequestsModule),
        forwardRef(() => PromptsModule),
        forwardRef(() => ContextReferenceModule),
        KodyRulesValidationModule,
        GlobalCacheModule,
        forwardRef(() => PermissionValidationModule),
    ],
    providers: [
        ...UseCases,
        {
            provide: KODY_RULES_REPOSITORY_TOKEN,
            useClass: KodyRulesRepository,
        },
        {
            provide: KODY_RULES_SERVICE_TOKEN,
            useClass: KodyRulesService,
        },
        KodyRulesValidationService,
        KodyRulesSyncService,
        KodyRuleDependencyService,
        ExternalReferenceLoaderService,
        {
            provide: GET_ADDITIONAL_INFO_HELPER_TOKEN,
            useClass: GetAdditionalInfoHelper,
        },
        LicenseService,
    ],
    exports: [
        KODY_RULES_REPOSITORY_TOKEN,
        KODY_RULES_SERVICE_TOKEN,
        GenerateKodyRulesUseCase,
        FindRulesInOrganizationByRuleFilterKodyRulesUseCase,
        ChangeStatusKodyRulesUseCase,
        CreateOrUpdateKodyRulesUseCase,
        SendRulesNotificationUseCase,
        KodyRulesValidationService,
        KodyRulesSyncService,
        KodyRuleDependencyService,
        ExternalReferenceLoaderService,
        SyncSelectedRepositoriesKodyRulesUseCase,
        LicenseService,
    ],
})
export class KodyRulesCoreModule {}
