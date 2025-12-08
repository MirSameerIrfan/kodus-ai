import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationModule } from '@libs/organization/organization.module';
import { UserModel } from '@libs/core/database/typeorm/schema/user.model';
import { AuthModule } from '@libs/identity/modules/auth.module';
import { ProfilesModule } from '@libs/identity/modules/profileConfig.module';
import { TeamsModule } from '@libs/organization/modules/team.module';
import { TeamMembersModule } from '@libs/organization/modules/teamMembers.module';
import { CodeReviewSettingsLogModule } from '@libs/analytics/modules/settings-log.module';
import { USER_REPOSITORY_TOKEN } from '../domain/user/contracts/user.repository.contract';
import { UserDatabaseRepository } from '@libs/core/database/typeorm/repositories/user.repository';
import { USER_SERVICE_TOKEN } from '../domain/user/contracts/user.service.contract';
import { UsersService } from '@libs/identity/infrastructure/services/users.service';
import { PASSWORD_SERVICE_TOKEN } from '../domain/user/contracts/password.service.contract';
import { BcryptService } from '@libs/identity/infrastructure/services/bcrypt.service';
import { UsersController } from 'apps/api/src/controllers/user.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([UserModel]),
        forwardRef(() => AuthModule),
        forwardRef(() => ProfilesModule),
        forwardRef(() => TeamsModule),
        forwardRef(() => TeamMembersModule),
        forwardRef(() => OrganizationModule),
        forwardRef(() => ProfilesModule),
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
    exports: [USER_REPOSITORY_TOKEN, USER_SERVICE_TOKEN],
    controllers: [UsersController],
})
export class UsersModule {}
