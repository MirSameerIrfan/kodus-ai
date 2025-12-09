import { IsOptional, IsString, IsNumber } from 'class-validator';

import { LabelType } from '@libs/common/utils/codeManagement/labels';
import { SeverityLevel } from '@libs/common/utils/enums/severityLevel.enum';
import { IssueStatus } from '@libs/core/infrastructure/config/types/general/issues.type';

export class GetIssuesByFiltersDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    severity?: SeverityLevel;

    @IsOptional()
    category?: LabelType;

    @IsOptional()
    status?: IssueStatus;

    @IsOptional()
    @IsString()
    organizationId?: string;

    @IsOptional()
    @IsString()
    repositoryName?: string;

    @IsOptional()
    @IsNumber()
    prNumber?: number;

    @IsOptional()
    @IsString()
    filePath?: string;

    @IsOptional()
    @IsString()
    prAuthor?: string;

    @IsOptional()
    @IsString()
    beforeAt?: string;

    @IsOptional()
    @IsString()
    afterAt?: string;
}
