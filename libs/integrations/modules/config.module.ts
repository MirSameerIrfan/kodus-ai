import { Module } from '@nestjs/common';
import { IntegrationConfigController } from 'apps/api/src/controllers/integrationConfig.controller';
import { IntegrationConfigCoreModule } from './config-core.module';

@Module({
    imports: [IntegrationConfigCoreModule],
    controllers: [IntegrationConfigController],
    providers: [],
    exports: [],
})
export class IntegrationConfigModule {}
