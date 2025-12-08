import {
    PullRequestMessageStatus,
    PullRequestMessageType,
} from '@libs/common/types/general/pullRequestMessages.type';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class PullRequestMessagesDto {
    @IsString()
    public organizationId?: string;

    @IsString()
    public pullRequestMessageType: PullRequestMessageType;

    @IsString()
    public status: PullRequestMessageStatus;

    @IsOptional()
    @IsString()
    public content: string;

    @IsObject()
    public repository?: { id: string; name: string };
}
