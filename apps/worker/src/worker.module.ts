import { Module } from '@nestjs/common';

import { WorkflowModule } from '@libs/core/workflow/workflow.module';

import { SharedMongoModule } from '@libs/shared/database/shared-mongo.module';
import { SharedPostgresModule } from '@libs/shared/database/shared-postgres.module';
import { SharedConfigModule } from '@libs/shared/infrastructure/shared-config.module';
import { SharedLogModule } from '@libs/shared/infrastructure/shared-log.module';

@Module({
    imports: [
        SharedConfigModule,
        SharedLogModule,
        SharedPostgresModule.forRoot({ poolSize: 12 }),
        SharedMongoModule.forRoot(),

        WorkflowModule.register({ type: 'worker' }),
        // CodebaseModule,
        // AutomationModule,
        // PlatformModule,
    ],
})
export class WorkerModule {}
