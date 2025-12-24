import { IsObject, IsOptional, IsString } from 'class-validator';

import {
    PullRequestMessageStatus,
    PullRequestMessageType,
} from '@libs/core/infrastructure/config/types/general/pullRequestMessages.type';

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
