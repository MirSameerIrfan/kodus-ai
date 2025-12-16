import { Module, forwardRef } from '@nestjs/common';

import { GlobalCacheModule } from '@libs/core/cache/cache.module';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { IntegrationCoreModule } from '@libs/integrations/modules/integrations-core.module';
import { PlatformCoreModule } from './platform-core.module';
import { GitlabService } from '../infrastructure/adapters/services/gitlab.service';

@Module({
    imports: [
        forwardRef(() => AuthIntegrationModule),
        forwardRef(() => IntegrationCoreModule),
        forwardRef(() => IntegrationConfigCoreModule),
        forwardRef(() => PlatformCoreModule),
        forwardRef(() => GlobalCacheModule),
    ],
    providers: [GitlabService],
    exports: [GitlabService],
})
export class GitlabModule {}
