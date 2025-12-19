import { Module, forwardRef } from '@nestjs/common';
import { PermissionValidationService } from './services/permissionValidation.service';
import { LicenseModule } from '../license/license.module';
import { TeamModule } from '@libs/organization/modules/team.module';
import { OrganizationParametersModule } from '@libs/organization/modules/organizationParameters.module';
import { AutomationModule } from '@libs/automation/modules/automation.module';
import { PlatformDataModule } from '@libs/platformData/platformData.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';

@Module({
    imports: [
        forwardRef(() => LicenseModule),
        forwardRef(() => TeamModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => AutomationModule),
        forwardRef(() => PlatformDataModule),
    ],
    providers: [PermissionValidationService],
    exports: [PermissionValidationService],
})
export class PermissionValidationModule {}
