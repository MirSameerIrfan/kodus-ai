import { Module, forwardRef } from '@nestjs/common';
import { PermissionValidationService } from './services/permissionValidation.service';
import { LicenseModule } from '../license/license.module';

@Module({
    imports: [
        forwardRef(() => LicenseModule),
        forwardRef(() => OrganizationParametersModule),
    ],
    providers: [PermissionValidationService],
    exports: [PermissionValidationService],
})
export class PermissionValidationModule {}
