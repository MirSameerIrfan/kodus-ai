import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EcsTaskProtectionService } from './ecs-task-protection.service';
import { TASK_PROTECTION_SERVICE_TOKEN } from '@libs/core/workflow/domain/contracts/task-protection.service.contract';

@Module({
    imports: [HttpModule],
    providers: [
        {
            provide: TASK_PROTECTION_SERVICE_TOKEN,
            useClass: EcsTaskProtectionService,
        },
    ],
    exports: [TASK_PROTECTION_SERVICE_TOKEN],
})
export class EcsModule {}
