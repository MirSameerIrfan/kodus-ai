import { INTEGRATION_REPOSITORY_TOKEN } from '@libs/core/domain/integrations/contracts/integration.repository.contracts';
import { IntegrationRepository } from '@libs/core/infrastructure/adapters/repositories/typeorm/integration.repository';
import { IntegrationModel } from '@libs/core/infrastructure/adapters/repositories/typeorm/schema/integration.model';
import { IntegrationService } from '@libs/core/infrastructure/adapters/services/integrations/integration.service';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UseCases } from '@libs/core/application/use-cases/integrations';
import { INTEGRATION_SERVICE_TOKEN } from '@libs/core/domain/integrations/contracts/integration.service.contracts';
import { IntegrationController } from '@libs/core/infrastructure/http/controllers/integrations/integration.controller';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { PlatformIntegrationModule } from '@libs/platform/platform.module';
import { ProfileConfigModule } from '@libs/identity/modules/profileConfig.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([IntegrationModel]),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => ProfileConfigModule),
        AuthIntegrationModule,
    ],
    providers: [
        ...UseCases,
        {
            provide: INTEGRATION_SERVICE_TOKEN,
            useClass: IntegrationService,
        },
        {
            provide: INTEGRATION_REPOSITORY_TOKEN,
            useClass: IntegrationRepository,
        },
    ],
    exports: [INTEGRATION_SERVICE_TOKEN, INTEGRATION_REPOSITORY_TOKEN],
    controllers: [IntegrationController],
})
export class IntegrationModule {}
