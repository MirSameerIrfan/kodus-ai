import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsArray } from 'class-validator';

import { PaginationDto } from '@libs/core/domain/dtos/pagination.dto';
import { ProgrammingLanguage } from '@libs/core/domain/enums/programming-language.enum';
import { KodyRuleFilters } from '@libs/core/infrastructure/config/types/kodyRules.type';

const transformToArray = ({ value }: { value: unknown }): string[] => {
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return Array.isArray(value) ? value : [];
};

export class FindLibraryKodyRulesDto
    extends PaginationDto
    implements KodyRuleFilters
{
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    severity?: string;

    @IsOptional()
    @Transform(transformToArray)
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @IsOptional()
    language?: ProgrammingLanguage;

    @IsOptional()
    @Transform(transformToArray)
    @IsArray()
    @IsString({ each: true })
    buckets?: string[];
}
