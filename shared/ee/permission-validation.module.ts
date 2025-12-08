import { LicenseModule } from '@libs/organization/ee/license/license.module';
import { OrganizationParametersModule } from '@libs/organization/modules/org-parameters.module';
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
