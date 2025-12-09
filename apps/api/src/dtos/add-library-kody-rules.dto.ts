import { Type } from 'class-transformer';
import {
    IsOptional,
    IsString,
    IsNotEmpty,
    IsEnum,
    IsArray,
    ValidateNested,
} from 'class-validator';

import {
    KodyRulesOrigin,
    KodyRulesStatus,
} from '@libs/kody-rules/domain/interfaces/kodyRules.interface';

import { KodyRulesExampleDto } from './create-kody-rule.dto';

export enum KodyRuleSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

export class DirectoryInfoDto {
    @IsNotEmpty()
    @IsString()
    directoryId: string;

    @IsNotEmpty()
    @IsString()
    repositoryId: string;
}

export class AddLibraryKodyRulesDto {
    @IsOptional()
    @IsString()
    uuid?: string;

    @IsNotEmpty()
    @IsString()
    title: string;

    @IsNotEmpty()
    @IsString()
    rule: string;

    @IsOptional()
    @IsString()
    path: string;

    @IsNotEmpty()
    @IsEnum(KodyRuleSeverity)
    severity: KodyRuleSeverity;

    @IsArray()
    @IsString({ each: true })
    repositoriesIds: string[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DirectoryInfoDto)
    @IsOptional()
    directoriesInfo?: DirectoryInfoDto[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => KodyRulesExampleDto)
    examples: KodyRulesExampleDto[];

    @IsOptional()
    @IsEnum(KodyRulesOrigin)
    origin?: KodyRulesOrigin;

    @IsOptional()
    @IsEnum(KodyRulesStatus)
    status?: KodyRulesStatus;

    @IsOptional()
    @IsString()
    scope?: string;
}
