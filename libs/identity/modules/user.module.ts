import { UseCases } from '@libs/core/application/use-cases/user';
import { PASSWORD_SERVICE_TOKEN } from '@libs/core/domain/user/contracts/password.service.contract';
import { USER_REPOSITORY_TOKEN } from '@libs/core/domain/user/contracts/user.repository.contract';
import { USER_SERVICE_TOKEN } from '@libs/core/domain/user/contracts/user.service.contract';
import { UserModel } from '@libs/core/infrastructure/adapters/repositories/typeorm/schema/user.model';
import { UserDatabaseRepository } from '@libs/core/infrastructure/adapters/repositories/typeorm/user.repository';
import { BcryptService } from '@libs/core/infrastructure/adapters/services/bcrypt.service';
import { UsersService } from '@libs/core/infrastructure/adapters/services/users.service';
import { UsersController } from '@libs/core/infrastructure/http/controllers/user.controller';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@libs/auth.module';
import { CodeReviewSettingsLogModule } from '@libs/codeReviewSettingsLog.module';
import { OrganizationModule } from '@libs/organization/organization.module';
import { ProfilesModule } from '@libs/profiles.module';
import { TeamsModule } from '@libs/team.module';
import { TeamMembersModule } from '@libs/teamMembers.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([UserModel]),
        forwardRef(() => AuthModule),
        forwardRef(() => ProfilesModule),
        forwardRef(() => TeamsModule),
        forwardRef(() => TeamMembersModule),
        forwardRef(() => OrganizationModule),
        forwardRef(() => ProfilesModule),
        forwardRef(() => CodeReviewSettingsLogModule)
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
