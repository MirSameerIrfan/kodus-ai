/**
 * @license
 * Kodus Tech. All rights reserved.
 */

import { forwardRef, Module } from '@nestjs/common';
import { PermissionValidationModule } from '../shared/permission-validation.module';
import { KodyRulesValidationService } from '@libs/service/kody-rules-validation.service';

@Module({
    imports: [forwardRef(() => PermissionValidationModule)],
    providers: [KodyRulesValidationService],
    exports: [KodyRulesValidationService],
})
export class KodyRulesValidationModule {}
