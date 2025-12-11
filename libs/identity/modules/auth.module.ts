import { Module } from '@nestjs/common';
import { AuthController } from 'apps/api/src/controllers/auth.controller';
import { AuthCoreModule } from './auth-core.module';
import { UserCoreModule } from './user-core.module';

@Module({
    imports: [AuthCoreModule, UserCoreModule],
    controllers: [AuthController, SSOConfigController],
    providers: [],
    exports: [],
})
export class AuthModule {}
