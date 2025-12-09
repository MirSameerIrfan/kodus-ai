import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { RepositoryTreeType } from '@libs/core/utils/enums/repositoryTree.enum';

export class GetRepositoryTreeDto {
    @IsString()
    organizationId: string;

    @IsString()
    teamId: string;

    @IsString()
    repositoryId: string;

    @IsEnum(RepositoryTreeType)
    @IsOptional()
    treeType?: RepositoryTreeType;

    @IsBoolean()
    @IsOptional()
    useCache?: boolean;
}
