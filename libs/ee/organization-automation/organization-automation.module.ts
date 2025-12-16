import { Module, forwardRef } from '@nestjs/common';
import { CodebaseModule } from '@libs/code-review/modules/codebase.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';
import { OrganizationParametersModule } from '@libs/organization/modules/organizationParameters.module';
import { SyncIgnoredBotsUseCase } from './use-cases/sync-ignored-bots.use-case';
import { OrganizationAutomationController } from './controllers/organization-automation.controller';

@Module({
    imports: [
        forwardRef(() => CodebaseModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => OrganizationParametersModule),
    ],
    controllers: [OrganizationAutomationController],
    providers: [SyncIgnoredBotsUseCase],
    exports: [SyncIgnoredBotsUseCase],
})
export class OrganizationAutomationModule {}

