import { Module } from '@nestjs/common';
import { TeamController } from 'apps/api/src/controllers/team.controller';
import { TeamCoreModule } from './team-core.module';

@Module({
    imports: [TeamCoreModule],
    controllers: [TeamController],
    providers: [],
    exports: [],
})
export class TeamsModule {}
