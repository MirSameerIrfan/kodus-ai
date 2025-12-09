import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CodeReviewSettingsLogModule } from '@libs/analytics/modules/settings-log.module';
import { UseCases } from '@libs/application/use-cases/kodyRules';
import { ChangeStatusKodyRulesUseCase } from '@libs/application/use-cases/kodyRules/change-status-kody-rules.use-case';
import { CreateOrUpdateKodyRulesUseCase } from '@libs/application/use-cases/kodyRules/create-or-update.use-case';
import { FindRulesInOrganizationByRuleFilterKodyRulesUseCase } from '@libs/application/use-cases/kodyRules/find-rules-in-organization-by-filter.use-case';
import { GenerateKodyRulesUseCase } from '@libs/application/use-cases/kodyRules/generate-kody-rules.use-case';
import { SendRulesNotificationUseCase } from '@libs/application/use-cases/kodyRules/send-rules-notification.use-case';
import { SyncSelectedRepositoriesKodyRulesUseCase } from '@libs/application/use-cases/kodyRules/sync-selected-repositories.use-case';
import { GlobalCacheModule } from '@libs/cache.module';
import { CodebaseModule } from '@libs/code-review/code-review.module';
import { ContextReferenceModule } from '@libs/code-review/modules/contextReference.module';
import { PromptsModule } from '@libs/code-review/modules/prompts.module';
import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';
import { KODY_RULES_REPOSITORY_TOKEN } from '@libs/domain/kodyRules/contracts/kodyRules.repository.contract';
import { KODY_RULES_SERVICE_TOKEN } from '@libs/domain/kodyRules/contracts/kodyRules.service.contract';
import { KodyRulesSyncService } from '@libs/infrastructure/adapters/services/kodyRules/kodyRulesSync.service';
import { KodyRulesController } from '@libs/infrastructure/http/controllers/kodyRules.controller';
import { KodyRulesValidationModule } from '@libs/ee/kodyRules/kody-rules-validation.module';
import { KodyRulesRepository } from '@libs/ee/kodyRules/repository/kodyRules.repository';
import { KodyRulesValidationService } from '@libs/ee/kodyRules/service/kody-rules-validation.service';
import { KodyRulesService } from '@libs/ee/kodyRules/service/kodyRules.service';
import { LicenseModule } from '@libs/ee/license/license.module';
import { LicenseService } from '@libs/ee/license/license.service';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { GET_ADDITIONAL_INFO_HELPER_TOKEN } from '@libs/shared/domain/contracts/getAdditionalInfo.helper.contract';
import { GetAdditionalInfoHelper } from '@libs/shared/utils/helpers/getAdditionalInfo.helper';

import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { OrganizationModule } from '@libs/organization/organization.module';
import { OrganizationParametersModule } from '@libs/organization/modules/org-parameters.module';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { PlatformIntegrationModule } from '@libs/platform/platform.module';
import { RuleLikeModule } from '@libs/ruleLike.module';
import { UsersModule } from '@libs/identity/modules/user.module';
import {
    KodyRulesModel,
    KodyRulesSchema,
} from '@libs/infrastructure/adapters/repositories/mongoose/schema/kodyRules.model';
import { ExternalReferenceLoaderService } from '@libs/infrastructure/adapters/services/kodyRules/externalReferenceLoader.service';
import { KodyRuleDependencyService } from '@libs/infrastructure/adapters/services/kodyRules/kodyRulesDependency.service';

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
        forwardRef(() => ParametersModule),
        forwardRef(() => UsersModule),
        forwardRef(() => OrganizationModule),
        forwardRef(() => CodeReviewSettingsLogModule),
        forwardRef(() => RuleLikeModule),
        forwardRef(() => LicenseModule),
        forwardRef(() => OrganizationParametersModule),
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
    controllers: [KodyRulesController],
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
export class KodyRulesModule {}
