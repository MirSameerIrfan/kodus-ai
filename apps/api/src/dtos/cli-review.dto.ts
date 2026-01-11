import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, IsEnum, MaxLength, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { PlatformType } from '@libs/core/domain/enums/platform-type.enum';

class CliFileInputDto {
    @IsString()
    @MaxLength(500, { message: 'File path too long (max 500 characters)' })
    path: string;

    @IsString()
    @MaxLength(2000000, { message: 'File content too large (max 2MB)' })
    content: string;

    @IsEnum(['added', 'modified', 'deleted', 'renamed'])
    status: 'added' | 'modified' | 'deleted' | 'renamed';

    @IsString()
    @MaxLength(500000, { message: 'Diff too large (max 500KB)' })
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
    @ArrayMaxSize(100, { message: 'Too many files (max 100 files per request)' })
    @ValidateNested({ each: true })
    @Type(() => CliFileInputDto)
    files?: CliFileInputDto[];
}

export class CliReviewRequestDto {
    @IsString()
    @MaxLength(5000000, { message: 'Diff too large (max 5MB)' })
    diff: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => CliConfigDto)
    config?: CliConfigDto;

    @IsOptional()
    @IsString()
    @MaxLength(254, { message: 'Email too long' })
    userEmail?: string; // git config user.email for tracking

    @IsOptional()
    @IsString()
    @MaxLength(500, { message: 'Git remote URL too long' })
    gitRemote?: string; // git remote get-url origin

    @IsOptional()
    @IsString()
    @MaxLength(255, { message: 'Branch name too long' })
    branch?: string; // git branch --show-current

    @IsOptional()
    @IsString()
    @MaxLength(40, { message: 'Commit SHA too long' })
    commitSha?: string; // git rev-parse HEAD

    @IsOptional()
    @IsEnum(PlatformType)
    inferredPlatform?: PlatformType; // Inferred from gitRemote

    @IsOptional()
    @IsString()
    @MaxLength(50, { message: 'CLI version too long' })
    cliVersion?: string; // CLI version for tracking
}

export class TrialCliReviewRequestDto extends CliReviewRequestDto {
    @IsString()
    fingerprint: string; // Device fingerprint for rate limiting
}
