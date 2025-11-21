/**
 * @license
 * Kodus Tech. All rights reserved.
 */

import { OrganizationParametersModule } from '@/modules/organizationParameters.module';
import { PullRequestsModule } from '@/modules/pullRequests.module';
import { forwardRef, Module } from '@nestjs/common';
import { LICENSE_SERVICE_TOKEN } from './interfaces/license.interface';
import { LicenseService } from './license.service';
import { AutoAssignLicenseUseCase } from './use-cases/auto-assign-license.use-case';

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
