import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { GithubModule } from './modules/github/github.module';
import { GitlabModule } from './modules/gitlab/gitlab.module';
import { BitbucketModule } from './modules/bitbucket/bitbucket.module';
import { AzureReposModule } from './modules/azure-repos/azure-repos.module';
import { PlatformFactory } from './infrastructure/services/platform.factory';
import { CodeManagementService } from './infrastructure/services/codeManagement.service';
import { ICodeManagementService } from '../domain/interfaces/code-management.interface';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';

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
