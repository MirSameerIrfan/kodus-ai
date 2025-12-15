import { Module, forwardRef } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeReviewSettingsLogModule } from '@libs/ee/codeReviewSettingsLog/codeReviewSettingsLog.module';
import { ProfilesModule } from './profiles.module';
import { AuthModule } from './auth.module'; // Import Core module
import { TeamMembersModule } from '@libs/organization/modules/teamMembers.module';

import { UserModel } from '../infrastructure/adapters/repositories/schemas/user.model';

import { PASSWORD_SERVICE_TOKEN } from '../domain/user/contracts/password.service.contract';
import { USER_REPOSITORY_TOKEN } from '../domain/user/contracts/user.repository.contract';
import { USER_SERVICE_TOKEN } from '../domain/user/contracts/user.service.contract';
import { UseCases } from '../application/use-cases/user'; // Fixed import
import { OrganizationModule } from '@libs/organization/modules/organization.module';
import { UsersService } from '../infrastructure/adapters/services/users.service';
import { BcryptService } from '../infrastructure/adapters/services/bcrypt.service';
import { ProfileConfigModule } from './profileConfig.module';
import { TeamModule } from '@libs/organization/modules/team.module';
import { UserDatabaseRepository } from '../infrastructure/adapters/repositories/user.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([UserModel]),
        forwardRef(() => AuthModule),
        forwardRef(() => ProfilesModule),
        forwardRef(() => ProfileConfigModule),
        forwardRef(() => TeamModule),
        forwardRef(() => TeamMembersModule),
        forwardRef(() => OrganizationModule),
        forwardRef(() => CodeReviewSettingsLogModule),
    ],
    providers: [
        ...UseCases,
        {
            provide: USER_REPOSITORY_TOKEN,
            useClass: UserDatabaseRepository,
        },
        {
            provide: USER_SERVICE_TOKEN,
            useClass: UsersService,
        },
        {
            provide: PASSWORD_SERVICE_TOKEN,
            useClass: BcryptService,
        },
    ],
    exports: [
        USER_REPOSITORY_TOKEN,
        USER_SERVICE_TOKEN,
        PASSWORD_SERVICE_TOKEN,
    ],
})
export class UserModule {}
