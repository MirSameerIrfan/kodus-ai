/**
 * @license
 * Kodus Tech. All rights reserved.
 */

import { OrganizationParametersModule } from '@libs/organization/organization.module';
import { PullRequestsModule } from '@libs/code-review/code-review.module';
import { forwardRef, Module } from '@nestjs/common';
import { LICENSE_SERVICE_TOKEN } from '@libs/interfaces/license.interface';
import { LicenseService } from '@libs/license.service';
import { AutoAssignLicenseUseCase } from '@libs/use-cases/auto-assign-license.use-case';

@Module({
    imports: [forwardRef(() => OrganizationParametersModule), forwardRef(() => PullRequestsModule)],
    providers: [
        {
            provide: LICENSE_SERVICE_TOKEN,
            useClass: LicenseService,
        },
        AutoAssignLicenseUseCase,
    ],
    exports: [LICENSE_SERVICE_TOKEN, AutoAssignLicenseUseCase],
})
export class LicenseModule {}
