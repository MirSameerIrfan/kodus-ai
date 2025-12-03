import { createLogger } from '@kodus/flow';
import { BadRequestException, Injectable } from '@nestjs/common';

import { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
import { CodeManagementService } from '@/core/infrastructure/adapters/services/platformIntegration/codeManagement.service';
import { IUseCase } from '@/shared/domain/interfaces/use-case.interface';

@Injectable()
export class GetWebhookStatusUseCase implements IUseCase {
    private readonly logger = createLogger(GetWebhookStatusUseCase.name);
    constructor(
        private readonly codeManagementService: CodeManagementService,
    ) {}

    public async execute(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        repositoryId: string;
    }): Promise<{ active: boolean }> {
        try {
            if (!params.repositoryId) {
                throw new BadRequestException('repositoryId é obrigatório.');
            }

            if (
                !params?.organizationAndTeamData?.organizationId ||
                !params?.organizationAndTeamData?.teamId
            ) {
                throw new BadRequestException(
                    'organizationId e teamId são obrigatórios.',
                );
            }

            const active = await this.codeManagementService.isWebhookActive({
                organizationAndTeamData: params.organizationAndTeamData,
                repositoryId: params.repositoryId,
            });

            return { active };
        } catch (error) {
            this.logger.error({
                message: 'Error while checking webhook status',
                context: GetWebhookStatusUseCase.name,
                error: error,
                metadata: {
                    ...params,
                },
            });

            return { active: false };
        }
    }
}
