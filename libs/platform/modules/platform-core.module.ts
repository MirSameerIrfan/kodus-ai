import { Module, forwardRef } from '@nestjs/common';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { IntegrationCoreModule } from '@libs/integrations/modules/integrations-core.module';
import { GithubModule } from './github.module';
import { GitlabModule } from './gitlab.module';
import { BitbucketModule } from './bitbucket.module';
import { AzureReposModule } from './azure-repos.module';
import { PlatformIntegrationFactory } from '../infrastructure/adapters/services/platformIntegration.factory';
import { CodeManagementService } from '../infrastructure/adapters/services/codeManagement.service';
import { PlatformDataModule } from '@libs/platformData/platformData.module';

@Module({
    imports: [
        forwardRef(() => IntegrationCoreModule),
        forwardRef(() => IntegrationConfigCoreModule),
        forwardRef(() => AuthIntegrationModule),
        GithubModule,
        GitlabModule,
        BitbucketModule,
        AzureReposModule,
        forwardRef(() => PlatformDataModule),
    ],
    providers: [PlatformIntegrationFactory, CodeManagementService],
    exports: [PlatformIntegrationFactory, CodeManagementService],
})
export class PlatformCoreModule {}
