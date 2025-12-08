import { AutomationType } from '@libs/automation/domain/enums/automation-type';
import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export class AutomationRunDto {
    @IsEnum(AutomationType)
    automationName: AutomationType;

    @IsNotEmpty()
    @IsUUID()
    teamId: string;

    @IsString()
    @IsOptional()
    channelId?: string;

    @IsString()
    @IsOptional()
    organizationId?: string;
}
