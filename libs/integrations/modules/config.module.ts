import { UseCasesIntegrationConfig } from '@libs/core/application/use-cases/integrations';
import { INTEGRATION_CONFIG_REPOSITORY_TOKEN } from '@libs/core/domain/integrationConfigs/contracts/integration-config.repository.contracts';
import { INTEGRATION_CONFIG_SERVICE_TOKEN } from '@libs/core/domain/integrationConfigs/contracts/integration-config.service.contracts';
import { IntegrationConfigRepository } from '@libs/core/infrastructure/adapters/repositories/typeorm/integrationConfig.repository';
import { IntegrationConfigModel } from '@libs/core/infrastructure/adapters/repositories/typeorm/schema/integrationConfig.model';
import { IntegrationConfigService } from '@libs/core/infrastructure/adapters/services/integrations/integrationConfig.service';
import { IntegrationConfigController } from '@libs/core/infrastructure/http/controllers/integrations/integrationConfig.controller';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationModule } from '@libs/integrations/integrations.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([IntegrationConfigModel]),
        forwardRef(() => IntegrationModule),
    ],
    providers: [
        ...UseCasesIntegrationConfig,
        {
            provide: INTEGRATION_CONFIG_SERVICE_TOKEN,
            useClass: IntegrationConfigService,
        },
        {
            provide: INTEGRATION_CONFIG_REPOSITORY_TOKEN,
            useClass: IntegrationConfigRepository,
        },
    ],
    exports: [
        INTEGRATION_CONFIG_SERVICE_TOKEN,
        INTEGRATION_CONFIG_REPOSITORY_TOKEN,
    ],
    controllers: [IntegrationConfigController],
})
export class IntegrationConfigModule {}
