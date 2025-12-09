import { Type } from 'class-transformer';
import {
    IsString,
    IsEnum,
    IsObject,
    IsOptional,
    ValidateNested,
    IsNumber,
} from 'class-validator';

import { LabelType } from '@libs/core/utils/codeManagement/labels';
import { SeverityLevel } from '@libs/core/utils/enums/severityLevel.enum';
import { IRepositoryToIssues } from '@libs/issues/domain/interfaces/kodyIssuesManagement.interface';


class GitUserDto {
    @IsNumber() gitId: number;
    @IsString() username: string;
}

export class CreateIssueManuallyDto {
    @IsString()
    title: string;

    @IsString()
    description: string;

    @IsString()
    filePath: string;

    @IsString()
    language: string;

    @IsEnum(LabelType)
    label: LabelType;

    @IsEnum(SeverityLevel)
    severity: SeverityLevel;

    @IsString()
    organizationId: string;

    @IsObject()
    repository: IRepositoryToIssues;

    @IsOptional()
    @ValidateNested()
    @Type(() => GitUserDto)
    owner: GitUserDto;

    @ValidateNested()
    @Type(() => GitUserDto)
    reporter: GitUserDto;
}
