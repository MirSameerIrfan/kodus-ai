import { PlatformType } from '@libs/common/enums/platform-type.enum';
import { IsEnum } from 'class-validator';

export class PlatformTypeDto {
    @IsEnum(PlatformType)
    platformType: PlatformType;
}
