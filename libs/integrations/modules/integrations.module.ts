import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationController } from 'apps/api/src/controllers/integrations/integration.controller';

import { IntegrationRepository } from '@libs/core/infrastructure/database/typeorm/repositories/integration.repository';
import { IntegrationModel } from '@libs/core/infrastructure/database/typeorm/schema/integration.model';
import { ProfileConfigModule } from '@libs/identity/modules/profileConfig.module';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { PlatformIntegrationModule } from '@libs/platform/platform.module';

import { INTEGRATION_REPOSITORY_TOKEN } from './domain/contracts/integration.repository.contracts';
import { INTEGRATION_SERVICE_TOKEN } from './domain/contracts/integration.service.contracts';
import { IntegrationService } from './infrastructure/integration.service';



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
