import { IsString } from 'class-validator';

export class UpdateConversationDto {
    @IsString()
    public message: string;
}
