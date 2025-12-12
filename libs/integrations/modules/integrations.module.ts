import { Module } from '@nestjs/common';
import { IntegrationCoreModule } from './integrations-core.module';

@Module({
    imports: [IntegrationCoreModule],
    exports: [IntegrationCoreModule],
})
export class IntegrationModule {}
