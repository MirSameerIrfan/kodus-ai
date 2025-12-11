import { IsString } from 'class-validator';

export class TeamQueryDto {
    @IsString()
    readonly teamId: string;
}
