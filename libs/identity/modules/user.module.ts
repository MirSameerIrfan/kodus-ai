import { Module, forwardRef } from '@nestjs/common';

import { CodeReviewSettingsLogModule } from '@libs/ee/codeReviewSettingsLog/codeReviewSettingsLog.module';
import { ProfilesModule } from './profiles.module';
import { AuthModule } from './auth.module'; // Import Core module
import { TeamMembersModule } from '@libs/organization/modules/teamMembers.module';

import { OrganizationModule } from '@libs/organization/modules/organization.module';
import { ProfileConfigModule } from './profileConfig.module';
import { TeamModule } from '@libs/organization/modules/team.module';
import { UserCoreModule } from './user-core.module';

@Module({
    imports: [
        forwardRef(() => AuthModule),
        forwardRef(() => ProfilesModule),
        forwardRef(() => ProfileConfigModule),
        forwardRef(() => TeamModule),
        forwardRef(() => TeamMembersModule),
        forwardRef(() => OrganizationModule),
        forwardRef(() => CodeReviewSettingsLogModule),
        UserCoreModule,
    ],
    exports: [UserCoreModule],
})
export class UserModule {}
