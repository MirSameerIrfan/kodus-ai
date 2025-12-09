import { Body, Controller, Post } from '@nestjs/common';

import { ConfirmEmailUseCase } from '@libs/identity/application/use-cases/auth/confirm-email.use-case';
import { ForgotPasswordUseCase } from '@libs/identity/application/use-cases/auth/forgotPasswordUseCase';
import { LoginUseCase } from '@libs/identity/application/use-cases/auth/login.use-case';
import { LogoutUseCase } from '@libs/identity/application/use-cases/auth/logout.use-case';
import { OAuthLoginUseCase } from '@libs/identity/application/use-cases/auth/oauth-login.use-case';
import { RefreshTokenUseCase } from '@libs/identity/application/use-cases/auth/refresh-toke.use-case';
import { ResendEmailUseCase } from '@libs/identity/application/use-cases/auth/resend-email.use-case';
import { ResetPasswordUseCase } from '@libs/identity/application/use-cases/auth/resetPasswordUseCase';
import { SignUpUseCase } from '@libs/identity/application/use-cases/auth/signup.use-case';

import { CreateUserOrganizationOAuthDto } from '../dtos/create-user-organization-oauth.dto';
import { SignUpDTO } from '../dtos/create-user-organization.dto';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly loginUseCase: LoginUseCase,
        private readonly refreshTokenUseCase: RefreshTokenUseCase,
        private readonly logoutUseCase: LogoutUseCase,
        private readonly signUpUseCase: SignUpUseCase,
        private readonly oAuthLoginUseCase: OAuthLoginUseCase,
        private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
        private readonly resetPasswordUseCase: ResetPasswordUseCase,
        private readonly confirmEmailUseCase: ConfirmEmailUseCase,
        private readonly resendEmailUseCase: ResendEmailUseCase,
    ) {}

    @Post('login')
    async login(@Body() body: { email: string; password: string }) {
        return await this.loginUseCase.execute(body.email, body.password);
    }

    @Post('logout')
    async logout(@Body() body: { refreshToken: string }) {
        return await this.logoutUseCase.execute(body.refreshToken);
    }

    @Post('refresh')
    async refresh(@Body() body: { refreshToken: string }) {
        return await this.refreshTokenUseCase.execute(body.refreshToken);
    }

    @Post('signUp')
    async signUp(@Body() body: SignUpDTO) {
        return await this.signUpUseCase.execute(body);
    }

    @Post('forgot-password')
    async forgotPassword(@Body() body: { email: string }) {
        return await this.forgotPasswordUseCase.execute(body.email);
    }
    @Post('reset-password')
    async resetPassword(@Body() body: { token: string; newPassword: string }) {
        return await this.resetPasswordUseCase.execute(
            body.token,
            body.newPassword,
        );
    }

    @Post('confirm-email')
    async confirmEmail(@Body() body: { token: string }) {
        return await this.confirmEmailUseCase.execute(body.token);
    }

    @Post('resend-email')
    async resendEmail(@Body() body: { email: string }) {
        return await this.resendEmailUseCase.execute(body.email);
    }

    @Post('oauth')
    async oAuth(@Body() body: CreateUserOrganizationOAuthDto) {
        const { name, email, refreshToken, authProvider } = body;

        return await this.oAuthLoginUseCase.execute(
            name,
            email,
            refreshToken,
            authProvider,
        );
    }
}
