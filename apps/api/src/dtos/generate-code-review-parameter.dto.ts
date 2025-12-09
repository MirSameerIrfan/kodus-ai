import {
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
} from 'class-validator';

import { AlignmentLevel } from '@libs/code-review/infrastructure/types/commentAnalysis.type';

export class GenerateCodeReviewParameterDTO {
    @IsString()
    teamId: string;

    @IsEnum(AlignmentLevel)
    @IsOptional()
    alignmentLevel?: AlignmentLevel;

    @IsNumber()
    @IsOptional()
    months?: number;

    @IsNumber()
    @IsOptional()
    weeks?: number;

    @IsNumber()
    @IsOptional()
    days?: number;
}
