import { ProfileConfigModel } from '@libs/core/infrastructure/database/typeorm/schema/profileConfig.model';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './user.module';
import { ProfilesModule } from '@libs/identity/modules/profileConfig.module';
import { PROFILE_CONFIG_SERVICE_TOKEN } from '../domain/profile-configs/contracts/profileConfig.service.contract';
import { PROFILE_CONFIG_REPOSITORY_TOKEN } from '../domain/profile-configs/contracts/profileConfig.repository.contract';
import { ProfileConfigService } from '@libs/identity/infrastructure/services/profileConfig.service';
import { ProfileConfigRepository } from '@libs/core/infrastructure/database/typeorm/repositories/profileConfig.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([ProfileConfigModel]),
        forwardRef(() => UsersModule),
        forwardRef(() => ProfilesModule),
    ],
    providers: [
        {
            provide: PROFILE_CONFIG_SERVICE_TOKEN,
            useClass: ProfileConfigService,
        },
        {
            provide: PROFILE_CONFIG_REPOSITORY_TOKEN,
            useClass: ProfileConfigRepository,
        },
    ],
    exports: [PROFILE_CONFIG_SERVICE_TOKEN, PROFILE_CONFIG_REPOSITORY_TOKEN],
})
export class ProfileConfigModule {}
