import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

class CliFileInputDto {
    @IsString()
    path: string;

    @IsString()
    content: string;

    @IsEnum(['added', 'modified', 'deleted', 'renamed'])
    status: 'added' | 'modified' | 'deleted' | 'renamed';

    @IsString()
    diff: string;
}

class CliReviewRulesDto {
    @IsOptional()
    @IsBoolean()
    security?: boolean;

    @IsOptional()
    @IsBoolean()
    performance?: boolean;

    @IsOptional()
    @IsBoolean()
    style?: boolean;

    @IsOptional()
    @IsBoolean()
    bestPractices?: boolean;
}

class CliConfigDto {
    @IsOptional()
    @IsString()
    severity?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => CliReviewRulesDto)
    rules?: CliReviewRulesDto;

    @IsOptional()
    @IsBoolean()
    rulesOnly?: boolean;

    @IsOptional()
    @IsBoolean()
    fast?: boolean;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CliFileInputDto)
    files?: CliFileInputDto[];
}

export class CliReviewRequestDto {
    @IsString()
    diff: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => CliConfigDto)
    config?: CliConfigDto;
}

export class TrialCliReviewRequestDto extends CliReviewRequestDto {
    @IsString()
    fingerprint: string; // Device fingerprint for rate limiting
}
