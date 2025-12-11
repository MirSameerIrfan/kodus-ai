import { Module } from '@nestjs/common';
import { AgentsCoreModule } from './agents-core.module';

@Module({
    imports: [AgentsCoreModule],
    exports: [AgentsCoreModule],
})
export class AgentsModule {}
