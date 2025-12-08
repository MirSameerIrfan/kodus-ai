import {
    IOrganizationService,
    ORGANIZATION_SERVICE_TOKEN,
} from '@libs/organization/domain/organization/contracts/organization.service.contract';
import { Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import posthogClient from '@libs/common/utils/posthog';
import { IUseCase } from '@libs/common/interfaces/use-case.interface';
import { UpdateProfileUseCase } from '@libs/identity/application/use-cases/profile/update.use-case';

export class UpdateInfoOrganizationAndPhoneUseCase implements IUseCase {
    constructor(
        @Inject(ORGANIZATION_SERVICE_TOKEN)
        private readonly organizationService: IOrganizationService,

        private readonly updateProfileUseCase: UpdateProfileUseCase,

        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string }; uuid: string };
        },
    ) {}

    public async execute(payload: any): Promise<boolean> {
        try {
            const organizationId = this.request.user.organization.uuid;
            const userId = this.request.user.uuid;

            const organization = await this.organizationService.update(
                { uuid: organizationId },
                { name: payload.name },
            );

            if (payload?.phone) {
                await this.updateProfileUseCase.execute({
                    user: { uuid: userId },
                    phone: payload?.phone,
                });
            }

            posthogClient.organizationIdentify(organization);

            return true;
        } catch {
            return false;
        }
    }
}
