import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

import { STATUS } from '@libs/core/infrastructure/config/types/database/status.type';
import { Role } from '@libs/identity/domain/permissions/enums/permissions.enum';

export class UpdateUserDto {
    @IsString()
    @IsOptional()
    @IsEmail()
    email?: string;

    @IsString()
    @IsOptional()
    password?: string;

    @IsOptional()
    @IsEnum(STATUS)
    status?: STATUS;

    @IsOptional()
    @IsEnum(Role)
    role?: Role;
}
