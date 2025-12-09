import { IsEnum } from 'class-validator';

import { PlatformType } from '@libs/core/domain/enums/platform-type.enum';

export class PlatformTypeDto {
    @IsEnum(PlatformType)
    platformType: PlatformType;
}
