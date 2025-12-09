import { IsArray, IsEnum, IsString } from 'class-validator';

import { KodyRulesStatus } from '@libs/kody-rules/domain/interfaces/kodyRules.interface';

export class ChangeStatusKodyRulesDTO {
    @IsArray()
    @IsString({ each: true })
    ruleIds: string[];

    @IsEnum(KodyRulesStatus)
    status: KodyRulesStatus;
}
