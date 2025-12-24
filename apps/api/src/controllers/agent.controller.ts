import { createThreadId } from '@kodus/flow';
import { ConversationAgentUseCase } from '@libs/agents/application/use-cases/conversation-agent.use-case';
import { OrganizationAndTeamDataDto } from '@libs/core/domain/dtos/organizationAndTeamData.dto';
import { UserRequest } from '@libs/core/infrastructure/config/types/http/user-request.type';
import { Body, Controller, Inject, Post } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

@Controller('agent')
export class AgentController {
    constructor(
        private readonly conversationAgentUseCase: ConversationAgentUseCase,

        @Inject(REQUEST)
        private readonly request: UserRequest,
    ) {}

    @Post('/conversation')
    public async conversation(
        @Body()
        body: {
            prompt: string;
            organizationAndTeamData: OrganizationAndTeamDataDto;
        },
    ) {
        const organizationId = this.request?.user?.organization?.uuid;

        if (!organizationId) {
            throw new Error('Organization ID missing in user request');
        }

        const thread = createThreadId(
            {
                organizationId,
                teamId: body.organizationAndTeamData.teamId,
            },
            {
                prefix: 'cmc', // Code Management Chat
            },
        );

        return this.conversationAgentUseCase.execute({ ...body, thread });
    }
}
