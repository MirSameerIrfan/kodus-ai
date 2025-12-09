import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';

import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';

@Module({
    imports: [
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => AuthIntegrationModule),
        GithubModule,
        GitlabModule,
        BitbucketModule,
        AzureReposModule,
    ],
    providers: [PlatformFactory, CodeManagementService],
    exports: [PlatformFactory, CodeManagementService],
})
export class PlatformModule implements OnModuleInit {
    constructor(
        private modulesContainer: ModulesContainer,
        private platformFactory: PlatformFactory,
    ) {}

    onModuleInit() {
        // Lógica de registro dos services no factory
    }
}
