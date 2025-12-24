import { IsEmail, IsString, IsEnum } from 'class-validator';

import { AuthProvider } from '@libs/core/domain/enums/auth-provider.enum';

export class CreateUserOrganizationOAuthDto {
    @IsString()
    public name: string;

    @IsString()
    @IsEmail()
    public email: string;

    @IsString()
    public refreshToken: string;

    @IsEnum(AuthProvider)
    public authProvider: AuthProvider;
}
