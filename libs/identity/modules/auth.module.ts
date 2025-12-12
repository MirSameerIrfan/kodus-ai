import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { jwtConfigLoader } from '@libs/core/infrastructure/config/loaders/jwt.config.loader';
import { JWT } from '@libs/core/infrastructure/config/types/jwt/jwt';
import { UseCases as AuthUseCases } from '@libs/identity/application/use-cases/auth';
import { UseCases as SSOConfigUseCases } from '@libs/identity/application/use-cases/sso';
import { AUTH_REPOSITORY_TOKEN } from '@libs/identity/domain/auth/contracts/auth.repository.contracts';
import { AUTH_SERVICE_TOKEN } from '@libs/identity/domain/auth/contracts/auth.service.contracts';
import { SSO_CONFIG_REPOSITORY_TOKEN } from '@libs/identity/domain/sso/contracts/ssoConfig.repository.contract';
import { SSO_CONFIG_SERVICE_TOKEN } from '@libs/identity/domain/sso/contracts/ssoConfig.service.contract';
import { AuthService } from '@libs/identity/infrastructure/adapters/services/auth/auth.service';
import { JwtStrategy } from '@libs/identity/infrastructure/adapters/services/auth/jwt-auth.strategy';
import { SamlStrategy } from '@libs/identity/infrastructure/adapters/services/auth/saml-auth.strategy';
import { SSOConfigService } from '@libs/identity/infrastructure/adapters/services/auth/ssoConfig.service';

import { TeamMembersModule } from '@libs/organization/modules/teamMembers.module';
import { AuthModel } from '../infrastructure/adapters/repositories/schemas/auth.model';
import { SSOConfigModel } from '../infrastructure/adapters/repositories/schemas/ssoConfig.model';
import { AuthRepository } from '../infrastructure/adapters/repositories/auth.repository';
import { SSOConfigRepository } from '../infrastructure/adapters/repositories/ssoConfig.repository';
import { OrganizationModule } from '@libs/organization/modules/organization.module';
import { TeamModule } from '@libs/organization/modules/team.module';
import { ProfilesModule } from './profiles.module';
import { UserModule } from './user.module';

@Module({
    imports: [
        UserModule,
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
        forwardRef(() => TeamModule),
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
    exports: [
        AUTH_SERVICE_TOKEN,
        JwtModule,
        AuthService,
        SSOConfigService,
        AUTH_REPOSITORY_TOKEN,
        SSO_CONFIG_REPOSITORY_TOKEN,
    ],
})
export class AuthModule {}
