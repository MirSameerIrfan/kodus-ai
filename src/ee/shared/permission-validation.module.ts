import { LicenseModule } from '@/ee/license/license.module';
import { OrganizationParametersModule } from '@/modules/organizationParameters.module';
import { Module, forwardRef } from '@nestjs/common';
import { PermissionValidationService } from './services/permissionValidation.service';

@Module({
    imports: [
        forwardRef(() => LicenseModule),
        forwardRef(() => OrganizationParametersModule),
    ],
    providers: [PermissionValidationService],
    exports: [PermissionValidationService],
})
export class PermissionValidationModule {}
