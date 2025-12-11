import { Module } from '@nestjs/common';

import { AutomationModule } from '@libs/automation/modules/automation.module';
import { CodebaseCoreModule } from '@libs/code-review/modules/codebase-core.module';
import { WorkflowModule } from '@libs/core/workflow/workflow.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';

import { SharedMongoModule } from '@libs/shared/database/shared-mongo.module';
import { SharedPostgresModule } from '@libs/shared/database/shared-postgres.module';
import { SharedConfigModule } from '@libs/shared/infrastructure/shared-config.module';
import { SharedLogModule } from '@libs/shared/infrastructure/shared-log.module';
import { SharedObservabilityModule } from '@libs/shared/infrastructure/shared-observability.module';

/**
 * Worker Module
 *
 * This module extends AppModule (base shared infrastructure) and adds:
 * - WorkflowModule (consumers, processors, relay services)
 * - NO HTTP controllers (no HTTP server)
 * - RabbitMQ consumers for job processing
 * - Outbox relay service for publishing messages
 *
 * Entry point: worker.ts (sem HTTP, apenas processamento)
 */
@Module({
    imports: [
        SharedConfigModule,
        SharedLogModule,
        SharedObservabilityModule,
        SharedPostgresModule.forRoot({ poolSize: 12 }),
        SharedMongoModule.forRoot(),

        WorkflowModule.register({ type: 'worker' }),
        CodebaseCoreModule,
        AutomationModule,
        PlatformModule,
    ],
    // No controllers - workers don't expose HTTP endpoints
    // No APP_GUARD - workers don't handle HTTP requests
})
export class WorkerModule {}
