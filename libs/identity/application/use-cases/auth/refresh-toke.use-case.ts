import {
    AUTH_SERVICE_TOKEN,
    IAuthService,
} from '@libs/identity/domain/auth/contracts/auth.service.contracts';
import { Inject, Injectable } from '@nestjs/common';
import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';

@Injectable()
export class RefreshTokenUseCase implements IUseCase {
    constructor(
        @Inject(AUTH_SERVICE_TOKEN)
        private readonly authService: IAuthService,
    ) {}

    async execute(oldRefreshToken: string) {
        const newTokens = await this.authService.refreshToken(oldRefreshToken);

        if (!newTokens) {
            throw new Error('Invalid refresh token');
        }

        return newTokens;
    }
}
