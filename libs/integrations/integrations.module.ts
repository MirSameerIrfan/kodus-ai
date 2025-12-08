import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { PlatformIntegrationModule } from '@libs/platform/platform.module';
import { ProfileConfigModule } from '@libs/identity/modules/profileConfig.module';
import { IntegrationModel } from '@libs/core/database/typeorm/schema/integration.model';
import { INTEGRATION_SERVICE_TOKEN } from './domain/contracts/integration.service.contracts';
import { IntegrationService } from './infrastructure/integration.service';
import { INTEGRATION_REPOSITORY_TOKEN } from './domain/contracts/integration.repository.contracts';
import { IntegrationController } from 'apps/api/src/controllers/integrations/integration.controller';
import { IntegrationRepository } from '@libs/core/database/typeorm/repositories/integration.repository';

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
