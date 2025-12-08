import { KodyRulesStatus } from '@libs/kody-rules/domain/interfaces/kodyRules.interface';
import { IsArray, IsEnum, IsString } from 'class-validator';

export class ChangeStatusKodyRulesDTO {
    @IsArray()
    @IsString({ each: true })
    ruleIds: string[];

    @IsEnum(KodyRulesStatus)
    status: KodyRulesStatus;
}
