import { IsEnum, IsOptional } from 'class-validator';
import { Role } from '@libs/identity/domain/permissions/enums/permissions.enum';
import { STATUS } from '@libs/core/domain/types/database/status.type';

export class UpdateAnotherUserDto {
    @IsOptional()
    @IsEnum(STATUS)
    status?: STATUS;

    @IsOptional()
    @IsEnum(Role)
    role?: Role;
}
