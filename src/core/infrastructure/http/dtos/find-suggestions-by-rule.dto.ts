import { IsNotEmpty, IsString } from 'class-validator';

export class FindSuggestionsByRuleDto {
    @IsNotEmpty()
    @IsString()
    ruleId: string;
}

