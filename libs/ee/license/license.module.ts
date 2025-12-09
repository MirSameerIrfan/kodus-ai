/**
 * @license
 * Kodus Tech. All rights reserved.
 */

import { forwardRef, Module } from '@nestjs/common';

import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';

import { LICENSE_SERVICE_TOKEN } from './interfaces/license.interface';
import { LicenseService } from './license.service';
import { AutoAssignLicenseUseCase } from './use-cases/auto-assign-license.use-case';

@Module({
    imports: [
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => PullRequestsModule),
    ],
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
