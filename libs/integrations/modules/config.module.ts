import { Module } from '@nestjs/common';
import { IntegrationConfigCoreModule } from './config-core.module';

@Module({
    imports: [IntegrationConfigCoreModule],
    exports: [IntegrationConfigCoreModule],
})
export class IntegrationConfigModule {}
