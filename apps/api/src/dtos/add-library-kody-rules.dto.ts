import {
    KodyRuleSeverity,
    KodyRulesExampleDto,
} from '@libs/ee/kodyRules/dtos/create-kody-rule.dto';
import {
    KodyRulesOrigin,
    KodyRulesStatus,
} from '@libs/kodyRules/domain/interfaces/kodyRules.interface';
import { Type } from 'class-transformer';
import {
    IsOptional,
    IsString,
    IsNotEmpty,
    IsEnum,
    IsArray,
    ValidateNested,
} from 'class-validator';

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
