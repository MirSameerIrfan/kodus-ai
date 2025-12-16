import { Module, OnModuleInit } from '@nestjs/common';
import { SharedMongoModule } from '@libs/shared/database/shared-mongo.module';
import { SharedPostgresModule } from '@libs/shared/database/shared-postgres.module';
import { SharedConfigModule } from '@libs/shared/infrastructure/shared-config.module';
import { SharedLogModule } from '@libs/shared/infrastructure/shared-log.module';
import { LLMModule } from '@kodus/kodus-common/llm';
import { KodusLoggerService } from '@libs/core/log/kodus-logger.service';
import { AutomationModule } from '@libs/automation/modules/automation.module';
import { WorkflowModule } from '@libs/core/workflow/workflow.module';
import { CodebaseModule } from '@libs/code-review/modules/codebase.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';

@Module({
    imports: [
        SharedConfigModule,
        SharedLogModule,
        SharedPostgresModule.forRoot({ poolSize: 12 }),
        SharedMongoModule.forRoot(),

        LLMModule.forRoot({
            logger: KodusLoggerService,
        }),

        WorkflowModule.register({ type: 'worker' }),
        CodebaseModule,
        AutomationModule,
        PlatformModule,
    ],
})
export class WorkerModule implements OnModuleInit {
    onModuleInit() {
        console.log('@@@ WorkerModule.onModuleInit called @@@');
    }
}
