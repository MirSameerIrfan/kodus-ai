import { ORGANIZATION_AUTOMATION_REPOSITORY_TOKEN } from '@/core/domain/automation/contracts/organization-automation.repository';
import { ORGANIZATION_AUTOMATION_SERVICE_TOKEN } from '@/core/domain/automation/contracts/organization-automation.service';
import { OrganizationAutomationRepository } from '@/core/infrastructure/adapters/repositories/typeorm/organizationAutomation.repository';
import { OrganizationModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/organization.model';
import { OrganizationAutomationModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/organizationAutomation.model';
import { OrganizationAutomationService } from '@/core/infrastructure/adapters/services/automation/organization-automation.service';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationModule } from './automation.module';
import { AutomationStrategyModule } from './automationStrategy.module';
import { IntegrationModule } from './integration.module';
import { IntegrationConfigModule } from './integrationConfig.module';
import { OrganizationModule } from './organization.module';
import { PlatformIntegrationModule } from './platformIntegration.module';
import { ProfileConfigModule } from './profileConfig.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrganizationAutomationModel]),
        forwardRef(() => OrganizationModel),
        forwardRef(() => AutomationStrategyModule),
        forwardRef(() => AutomationModule),
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => OrganizationModule),
        ProfileConfigModule,
    ],
    providers: [
        {
            provide: ORGANIZATION_AUTOMATION_REPOSITORY_TOKEN,
            useClass: OrganizationAutomationRepository,
        },
        {
            provide: ORGANIZATION_AUTOMATION_SERVICE_TOKEN,
            useClass: OrganizationAutomationService,
        },
    ],
    controllers: [],
    exports: [
        ORGANIZATION_AUTOMATION_REPOSITORY_TOKEN,
        ORGANIZATION_AUTOMATION_SERVICE_TOKEN,
    ],
})
export class OrganizationAutomationModule {}
