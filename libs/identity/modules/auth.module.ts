import { jwtConfigLoader } from '@libs/core/infrastructure/config/loaders/jwt.config.loader';
import { JWT } from '@libs/core/infrastructure/config/types/jwt/jwt';
import { UseCases as AuthUseCases } from '@libs/identity/application/use-cases/auth';
import { UseCases as SSOConfigUseCases } from '@libs/identity/application/use-cases/sso';
import { AUTH_REPOSITORY_TOKEN } from '@libs/identity/domain/auth/contracts/auth.repository.contracts';
import { AUTH_SERVICE_TOKEN } from '@libs/identity/domain/auth/contracts/auth.service.contracts';
import { SSO_CONFIG_REPOSITORY_TOKEN } from '@libs/identity/domain/sso/contracts/ssoConfig.repository.contract';
import { SSO_CONFIG_SERVICE_TOKEN } from '@libs/identity/domain/sso/contracts/ssoConfig.service.contract';
import { AuthRepository } from '@libs/identity/infrastructure/repositories/auth.repository';
import { AuthModel } from '@libs/identity/infrastructure/repositories/schemas/auth.model';
import { SSOConfigModel } from '@libs/identity/infrastructure/repositories/sso/ssoConfig.model';
import { SSOConfigRepository } from '@libs/identity/infrastructure/repositories/sso/ssoConfig.repository';
import { AuthService } from '@libs/identity/infrastructure/adapters/services/auth/auth.service';
import { JwtStrategy } from '@libs/identity/infrastructure/adapters/services/auth/jwt-auth.strategy';
import { SamlStrategy } from '@libs/identity/infrastructure/adapters/services/auth/saml-auth.strategy';
import { SSOConfigService } from '@libs/identity/infrastructure/adapters/services/auth/ssoConfig.service';
import { AuthController } from '@apps/api/controllers/auth.controller';
import { SSOConfigController } from '@apps/api/controllers/ssoConfig.controller';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationModule } from './organization.module';
import { ProfilesModule } from './profiles.module';
import { TeamsModule } from './team.module';
import { TeamMembersModule } from './teamMembers.module';
import { UsersModule } from './user.module';

@Module({
    imports: [
        forwardRef(() => UsersModule),
        TypeOrmModule.forFeature([AuthModel, SSOConfigModel]),
        ConfigModule.forFeature(jwtConfigLoader),
        PassportModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<JWT>('jwtConfig').secret,
                signOptions: {
                    expiresIn: configService.get<JWT>('jwtConfig').expiresIn,
                },
            }),
        }),
        forwardRef(() => OrganizationModule),
        TeamMembersModule,
        forwardRef(() => ProfilesModule),
        forwardRef(() => TeamsModule),
    ],
    providers: [
        ...AuthUseCases,
        ...SSOConfigUseCases,
        {
            provide: AUTH_REPOSITORY_TOKEN,
            useClass: AuthRepository,
        },
        JwtStrategy,
        SamlStrategy,
        {
            provide: AUTH_SERVICE_TOKEN,
            useClass: AuthService,
        },
        {
            provide: SSO_CONFIG_REPOSITORY_TOKEN,
            useClass: SSOConfigRepository,
        },
        {
            provide: SSO_CONFIG_SERVICE_TOKEN,
            useClass: SSOConfigService,
        },
    ],
    exports: [AUTH_SERVICE_TOKEN, JwtModule],
    controllers: [AuthController, SSOConfigController],
})
export class AuthModule {}
