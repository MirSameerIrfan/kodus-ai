import { Inject, Injectable } from '@nestjs/common';

import { ActionType } from '@libs/core/infrastructure/config/types/general/codeReviewSettingsLog.type';
import { createLogger } from '@kodus/flow';

import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import {
    CODE_REVIEW_SETTINGS_LOG_SERVICE_TOKEN,
    ICodeReviewSettingsLogService,
} from '@libs/ee/codeReviewSettingsLog/domain/contracts/codeReviewSettingsLog.service.contract';
import { UserStatusDto } from '@libs/ee/codeReviewSettingsLog/dtos/user-status-change.dto';

@Injectable()
export class RegisterUserStatusLogUseCase implements IUseCase {
    private readonly logger = createLogger(RegisterUserStatusLogUseCase.name);
    constructor(
        @Inject(CODE_REVIEW_SETTINGS_LOG_SERVICE_TOKEN)
        private readonly codeReviewSettingsLogService: ICodeReviewSettingsLogService,
    ) {}

    public async execute(userStatusDto: UserStatusDto): Promise<void> {
        try {
            const organizationId = userStatusDto.organizationId;

            await this.codeReviewSettingsLogService.registerUserStatusLog({
                organizationAndTeamData: {
                    organizationId,
                    teamId: userStatusDto.teamId || null,
                },
                userInfo: {
                    userId: userStatusDto.editedBy.userId || '',
                    userEmail: userStatusDto.editedBy.email || '',
                },
                userStatusChanges: [
                    {
                        gitId: userStatusDto.gitId,
                        gitTool: userStatusDto.gitTool,
                        userName: userStatusDto.userName,
                        licenseStatus: userStatusDto.licenseStatus === 'active',
                    },
                ],
                actionType: ActionType.EDIT,
            });
        } catch (error) {
            this.logger.error({
                message: 'Error registering user status log',
                context: RegisterUserStatusLogUseCase.name,
                error: error,
                metadata: {
                    ...userStatusDto,
                },
            });
        }
    }
}
