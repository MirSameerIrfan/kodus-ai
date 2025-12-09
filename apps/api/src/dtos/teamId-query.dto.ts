import { IsUUID } from 'class-validator';

export class TeamQueryDto {
    @IsUUID()
    teamId: string;
}
