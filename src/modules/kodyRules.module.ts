import { UseCases } from '@/core/application/use-cases/kodyRules';
import { ChangeStatusKodyRulesUseCase } from '@/core/application/use-cases/kodyRules/change-status-kody-rules.use-case';
import { CreateOrUpdateKodyRulesUseCase } from '@/core/application/use-cases/kodyRules/create-or-update.use-case';
import { FindRulesInOrganizationByRuleFilterKodyRulesUseCase } from '@/core/application/use-cases/kodyRules/find-rules-in-organization-by-filter.use-case';
import { GenerateKodyRulesUseCase } from '@/core/application/use-cases/kodyRules/generate-kody-rules.use-case';
import { SendRulesNotificationUseCase } from '@/core/application/use-cases/kodyRules/send-rules-notification.use-case';
import { SyncSelectedRepositoriesKodyRulesUseCase } from '@/core/application/use-cases/kodyRules/sync-selected-repositories.use-case';
import { KODY_RULES_REPOSITORY_TOKEN } from '@/core/domain/kodyRules/contracts/kodyRules.repository.contract';
import { KODY_RULES_SERVICE_TOKEN } from '@/core/domain/kodyRules/contracts/kodyRules.service.contract';
import {
    KodyRulesModel,
    KodyRulesSchema,
} from '@/core/infrastructure/adapters/repositories/mongoose/schema/kodyRules.model';
import { ExternalReferenceLoaderService } from '@/core/infrastructure/adapters/services/kodyRules/externalReferenceLoader.service';
import { KodyRulesSyncService } from '@/core/infrastructure/adapters/services/kodyRules/kodyRulesSync.service';
import { KodyRulesController } from '@/core/infrastructure/http/controllers/kodyRules.controller';
import { KodyRulesValidationModule } from '@/ee/kodyRules/kody-rules-validation.module';
import { KodyRulesRepository } from '@/ee/kodyRules/repository/kodyRules.repository';
import { KodyRulesValidationService } from '@/ee/kodyRules/service/kody-rules-validation.service';
import { KodyRulesService } from '@/ee/kodyRules/service/kodyRules.service';
import { LicenseModule } from '@/ee/license/license.module';
import { LicenseService } from '@/ee/license/license.service';
import { PermissionValidationModule } from '@/ee/shared/permission-validation.module';
import { GET_ADDITIONAL_INFO_HELPER_TOKEN } from '@/shared/domain/contracts/getAdditionalInfo.helper.contract';
import { GetAdditionalInfoHelper } from '@/shared/utils/helpers/getAdditionalInfo.helper';
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GlobalCacheModule } from './cache.module';
import { CodebaseModule } from './codeBase.module';
import { CodeReviewSettingsLogModule } from './codeReviewSettingsLog.module';
import { ContextReferenceModule } from './contextReference.module';
import { IntegrationModule } from './integration.module';
import { IntegrationConfigModule } from './integrationConfig.module';
import { OrganizationModule } from './organization.module';
import { OrganizationParametersModule } from './organizationParameters.module';
import { ParametersModule } from './parameters.module';
import { PlatformIntegrationModule } from './platformIntegration.module';
import { PromptsModule } from './prompts.module';
import { PullRequestsModule } from './pullRequests.module';
import { RuleLikeModule } from './ruleLike.module';
import { UsersModule } from './user.module';

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
        PermissionValidationModule,
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
        ExternalReferenceLoaderService,
        SyncSelectedRepositoriesKodyRulesUseCase,
        LicenseService,
    ],
})
export class KodyRulesModule {}
