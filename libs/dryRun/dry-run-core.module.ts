import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { DRY_RUN_REPOSITORY_TOKEN } from './domain/contracts/dryRun.repository.contract';
import { DRY_RUN_SERVICE_TOKEN } from './domain/contracts/dryRun.service.contract';

import { DryRunRepository } from './infrastructure/adapters/repositories/dryRun.repository';
import {
    DryRunModel,
    DryRunSchema,
} from './infrastructure/adapters/repositories/schemas/dryRun.model';
import { DryRunService } from './infrastructure/adapters/services/dryRun.service';
import { InternalCodeManagementService } from './infrastructure/adapters/services/internalCodeManagement.service';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { PullRequestMessagesModule } from '@libs/code-review/modules/pullRequestMessages.module';
import { CodebaseModule } from '@libs/code-review/modules/codebase.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: DryRunModel.name, schema: DryRunSchema },
        ]),
        EventEmitterModule.forRoot(),
        forwardRef(() => ParametersModule),
        forwardRef(() => PullRequestMessagesModule),
        forwardRef(() => CodebaseModule),
    ],
    providers: [
        { provide: DRY_RUN_REPOSITORY_TOKEN, useClass: DryRunRepository },
        { provide: DRY_RUN_SERVICE_TOKEN, useClass: DryRunService },
        InternalCodeManagementService,
    ],
    exports: [
        DRY_RUN_REPOSITORY_TOKEN,
        DRY_RUN_SERVICE_TOKEN,
        InternalCodeManagementService,
    ],
})
export class DryRunCoreModule {}
