import { BITBUCKET_SERVICE_TOKEN } from '@/core/domain/bitbucket/contracts/bitbucket.service.contract';
import { BitbucketService } from '@/core/infrastructure/adapters/services/bitbucket/bitbucket.service';
import { BitbucketController } from '@/core/infrastructure/http/controllers/bitbucket.controller';
import { LicenseModule } from '@/ee/license/license.module';
import { PermissionValidationModule } from '@/ee/shared/permission-validation.module';
import { forwardRef, Module } from '@nestjs/common';
import { AuthIntegrationModule } from './authIntegration.module';
import { CodebaseModule } from './codeBase.module';
import { IntegrationModule } from './integration.module';
import { IntegrationConfigModule } from './integrationConfig.module';
import { OrganizationParametersModule } from './organizationParameters.module';
import { ParametersModule } from './parameters.module';
import { PlatformIntegrationModule } from './platformIntegration.module';
import { WebhookLogModule } from './webhookLog.module';

@Module({
    imports: [
        forwardRef(() => AuthIntegrationModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => WebhookLogModule),
        forwardRef(() => LicenseModule),
        forwardRef(() => PermissionValidationModule),
    ],
    providers: [
        {
            provide: BITBUCKET_SERVICE_TOKEN,
            useClass: BitbucketService,
        },
    ],
    controllers: [BitbucketController],
    exports: [BITBUCKET_SERVICE_TOKEN],
})
export class BitbucketModule {}
