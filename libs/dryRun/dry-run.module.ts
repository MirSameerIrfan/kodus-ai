import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DRY_RUN_REPOSITORY_TOKEN } from './domain/contracts/dryRun.repository.contract';
import { DRY_RUN_SERVICE_TOKEN } from './domain/contracts/dryRun.service.contract';

import { ExecuteDryRunUseCase } from './application/use-cases/execute-dry-run.use-case';
import { GetDryRunUseCase } from './application/use-cases/get-dry-run.use-case';
import { GetStatusDryRunUseCase } from './application/use-cases/get-status-dry-run.use-case';
import { ListDryRunsUseCase } from './application/use-cases/list-dry-runs.use-case';
import { SseDryRunUseCase } from './application/use-cases/sse-dry-run.use-case';

import { DryRunRepository } from './infrastructure/adapters/repositories/dryRun.repository';
import {
    DryRunModel,
    DryRunSchema,
} from './infrastructure/adapters/repositories/schemas/dryRun.model';
import { DryRunService } from './infrastructure/adapters/services/dryRun.service';
import { InternalCodeManagementService } from './infrastructure/adapters/services/internalCodeManagement.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: DryRunModel.name, schema: DryRunSchema },
        ]),
    ],
    providers: [
        { provide: DRY_RUN_REPOSITORY_TOKEN, useClass: DryRunRepository },
        { provide: DRY_RUN_SERVICE_TOKEN, useClass: DryRunService },
        InternalCodeManagementService,
        DryRunPipelineStrategy,
        ExecuteDryRunUseCase,
        GetDryRunUseCase,
        GetStatusDryRunUseCase,
        ListDryRunsUseCase,
        SseDryRunUseCase,
    ],
    exports: [
        ExecuteDryRunUseCase,
        GetDryRunUseCase,
        GetStatusDryRunUseCase,
        ListDryRunsUseCase,
        SseDryRunUseCase,
    ],
})
export class DryRunModule {}
