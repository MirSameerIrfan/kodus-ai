import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { ReviewPreset } from '@libs/core/infrastructure/config/types/general/codeReview.type';
import { OrganizationAndTeamDataDto } from '@libs/core/domain/dtos/organizationAndTeamData.dto';

export class ApplyCodeReviewPresetDto {
    @IsEnum(ReviewPreset)
    preset: ReviewPreset;

    @IsNotEmpty()
    @IsString()
    teamId: string;

    @IsOptional()
    organizationAndTeamData?: OrganizationAndTeamDataDto;
}
