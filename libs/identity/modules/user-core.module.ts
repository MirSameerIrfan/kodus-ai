import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserModel } from '../infrastructure/adapters/repositories/schemas/user.model';

import { PASSWORD_SERVICE_TOKEN } from '../domain/user/contracts/password.service.contract';
import { USER_REPOSITORY_TOKEN } from '../domain/user/contracts/user.repository.contract';
import { USER_SERVICE_TOKEN } from '../domain/user/contracts/user.service.contract';
import { UseCases } from '../application/use-cases/user'; // Fixed import
import { UsersService } from '../infrastructure/adapters/services/users.service';
import { BcryptService } from '../infrastructure/adapters/services/bcrypt.service';
import { UserDatabaseRepository } from '../infrastructure/adapters/repositories/user.repository';

@Module({
    imports: [TypeOrmModule.forFeature([UserModel])],
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
export class UserCoreModule {}

