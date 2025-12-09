import { createThreadId } from '@kodus/flow';
import { Body, Controller, Post } from '@nestjs/common';

import { ConversationAgentUseCase } from '@libs/agents/application/use-cases/conversation-agent.use-case';

import { OrganizationAndTeamDataDto } from '@libs/core/domain/dtos/organizationAndTeamData.dto';

@Controller('agent')
export class AgentController {
    constructor(
        private readonly conversationAgentUseCase: ConversationAgentUseCase,
    ) {}

    @Post('/conversation')
    public async conversation(
        @Body()
        body: {
            prompt: string;
            organizationAndTeamData: OrganizationAndTeamDataDto;
        },
    ) {
        const thread = createThreadId(
            {
                organizationId: body.organizationAndTeamData.organizationId,
                teamId: body.organizationAndTeamData.teamId,
            },
            {
                prefix: 'cmc', // Code Management Chat
            },
        );
        return this.conversationAgentUseCase.execute({ ...body, thread });
    }
}
