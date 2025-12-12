import { Module, forwardRef } from '@nestjs/common';
import { PermissionValidationService } from './services/permissionValidation.service';
import { LicenseModule } from '../license/license.module';
import { TeamModule } from '@libs/organization/modules/team.module';

@Module({
    imports: [forwardRef(() => LicenseModule), forwardRef(() => TeamModule)],
    providers: [PermissionValidationService],
    exports: [PermissionValidationService],
})
export class PermissionValidationModule {}
