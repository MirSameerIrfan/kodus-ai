import { RuleFeedbackType } from '@libs/kodyRules/domain/entities/ruleLike.entity';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class SetRuleFeedbackDto {
    @IsNotEmpty()
    @IsEnum(RuleFeedbackType, {
        message: 'feedback must be either "positive" or "negative"',
    })
    feedback: RuleFeedbackType;
}
