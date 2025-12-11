import { Module } from '@nestjs/common';
import { UsersController } from 'apps/api/src/controllers/user.controller';
import { UserCoreModule } from './user-core.module';
import { AuthCoreModule } from './auth-core.module'; // Might be needed for guards/decorators used in Controller

@Module({
    imports: [
        UserCoreModule,
        // Often controllers need Auth guards which might depend on AuthModule/JwtModule
        // But if guards are global or provided by AuthModule, we might need it here.
        // Assuming UsersController needs AuthModule (e.g. for @UseGuards(JwtAuthGuard))
        AuthCoreModule,
    ],
    controllers: [UsersController],
    providers: [], // No providers here, they are in Core
    exports: [], // No exports needed usually, unless other Http modules need to import this (rare)
})
export class UsersModule {}
