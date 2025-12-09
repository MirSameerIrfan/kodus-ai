import {
    IsEnum,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
} from 'class-validator';

import { BehaviourForExistingDescription } from '@libs/core/infrastructure/config/types/general/codeReview.type';

export class PreviewPrSummaryDto {
    @IsNotEmpty()
    @IsString()
    prNumber: string;

    @IsNotEmpty()
    @IsObject()
    repository: {
        id: string;
        name: string;
    };

    @IsNotEmpty()
    @IsString()
    organizationId: string;

    @IsNotEmpty()
    @IsString()
    teamId: string;

    @IsNotEmpty()
    @IsEnum(BehaviourForExistingDescription)
    behaviourForExistingDescription: BehaviourForExistingDescription;

    @IsOptional()
    @IsString()
    customInstructions: string;
}
