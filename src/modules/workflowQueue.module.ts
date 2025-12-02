import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkflowQueueLoader } from '@/config/loaders/workflow-queue.loader';

@Module({
    imports: [
        ConfigModule.forFeature(WorkflowQueueLoader),
    ],
    providers: [
        // Providers serão adicionados nas próximas fases
    ],
    exports: [
        // Exports serão adicionados nas próximas fases
    ],
})
export class WorkflowQueueModule {}

