import { InviteDataUserUseCase } from '@libs/identity/application/use-cases/user/invite-data.use-case';
import {
    Body,
    Controller,
    Get,
    Inject,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';

import { AcceptUserInvitationUseCase } from '@libs/identity/application/use-cases/user/accept-user-invitation.use-case';
import { CheckUserWithEmailUserUseCase } from '@libs/identity/application/use-cases/user/check-user-email.use-case';
import { GetUserUseCase } from '@libs/identity/application/use-cases/user/get-user.use-case';
import { JoinOrganizationUseCase } from '@libs/identity/application/use-cases/user/join-organization.use-case';
import { UpdateAnotherUserUseCase } from '@libs/identity/application/use-cases/user/update-another.use-case';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { IUser } from '@libs/identity/domain/user/interfaces/user.interface';
import { REQUEST } from '@nestjs/core';
import {
    CheckPolicies,
    PolicyGuard,
} from '@libs/identity/infrastructure/permissions/policy.guard';
import { checkPermissions } from '@libs/identity/infrastructure/permissions/policy.handlers';
import { AcceptUserInvitationDto } from '../dtos/accept-user-invitation.dto';
import { JoinOrganizationDto } from '../dtos/join-organization.dto';
import { UpdateAnotherUserDto } from '../dtos/update-another-user.dto';

@Controller('user')
export class UsersController {
    constructor(
        private readonly getUserUseCase: GetUserUseCase,
        private readonly inviteDataUserUseCase: InviteDataUserUseCase,
        private readonly acceptUserInvitationUseCase: AcceptUserInvitationUseCase,
        private readonly checkUserWithEmailUserUseCase: CheckUserWithEmailUserUseCase,
        private readonly joinOrganizationUseCase: JoinOrganizationUseCase,
        private readonly updateAnotherUserUseCase: UpdateAnotherUserUseCase,

        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string }; uuid: string };
        },
    ) {}

    @Get('/email')
    public async getEmail(
        @Query('email')
        email: string,
    ) {
        return await this.checkUserWithEmailUserUseCase.execute(email);
    }

    @Get('/info')
    public async show() {
        return await this.getUserUseCase.execute();
    }

    @Get('/invite')
    public async getInviteDate(
        @Query('userId')
        userId: string,
    ) {
        return await this.inviteDataUserUseCase.execute(userId);
    }

    @Post('/invite/complete-invitation')
    public async completeInvitation(@Body() body: AcceptUserInvitationDto) {
        return await this.acceptUserInvitationUseCase.execute(body);
    }

    @Post('/join-organization')
    @UseGuards(PolicyGuard)
    @CheckPolicies(checkPermissions(Action.Create, ResourceType.UserSettings))
    public async joinOrganization(@Body() body: JoinOrganizationDto) {
        return await this.joinOrganizationUseCase.execute(body);
    }

    @Patch('/:targetUserId')
    @UseGuards(PolicyGuard)
    @CheckPolicies(checkPermissions(Action.Update, ResourceType.UserSettings))
    public async updateAnother(
        @Body() body: UpdateAnotherUserDto,
        @Param('targetUserId') targetUserId: string,
    ): Promise<IUser> {
        if (!targetUserId) {
            throw new Error('targetUserId is required');
        }

        const userId = this.request.user?.uuid;

        if (!userId) {
            throw new Error('User not found in request');
        }

        return await this.updateAnotherUserUseCase.execute(
            userId,
            targetUserId,
            body,
        );
    }
}
