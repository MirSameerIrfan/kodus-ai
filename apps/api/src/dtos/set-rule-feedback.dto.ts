import { IsEnum, IsNotEmpty } from 'class-validator';
import { RuleFeedbackType } from '@libs/kody-rules/domain/entities/ruleLike.entity';

export class SetRuleFeedbackDto {
    @IsNotEmpty()
    @IsEnum(RuleFeedbackType, {
        message: 'feedback must be either "positive" or "negative"',
    })
    feedback: RuleFeedbackType;
}
