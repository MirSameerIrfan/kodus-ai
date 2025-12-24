import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';

import { PaginationDto } from '@libs/core/domain/dtos/pagination.dto';
import {
    ActionType,
    ConfigLevel,
} from '@libs/core/infrastructure/config/types/general/codeReviewSettingsLog.type';

export class CodeReviewSettingsLogFiltersDto extends PaginationDto {
    @IsOptional()
    @IsUUID()
    teamId?: string;

    @IsOptional()
    @IsEnum(ActionType)
    action?: ActionType;

    @IsOptional()
    @IsEnum(ConfigLevel)
    configLevel?: ConfigLevel;

    @IsOptional()
    @IsString()
    userId?: string;

    @IsOptional()
    @IsString()
    userEmail?: string;

    @IsOptional()
    @IsString()
    repositoryId?: string;

    @IsOptional()
    @Transform(({ value }) => new Date(value))
    startDate?: Date;

    @IsOptional()
    @Transform(({ value }) => new Date(value))
    endDate?: Date;
}
