import { Module } from '@nestjs/common';
import { IntegrationController } from 'apps/api/src/controllers/integration.controller';
import { IntegrationCoreModule } from './integrations-core.module';

@Module({
    imports: [IntegrationCoreModule],
    controllers: [IntegrationController],
    providers: [],
    exports: [],
})
export class IntegrationModule {}
