import { Module } from '@nestjs/common';
import { TeamMembersCoreModule } from './teamMembers-core.module';
import { TeamMembersController } from 'apps/api/src/controllers/teamMembers.controller';

@Module({
    imports: [TeamMembersCoreModule],
    controllers: [TeamMembersController],
    providers: [],
    exports: [],
})
export class TeamMembersModule {}
