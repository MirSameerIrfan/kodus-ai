import {
    ISSOConfigService,
    SSO_CONFIG_SERVICE_TOKEN,
} from '@/core/domain/auth/contracts/ssoConfig.service.contract';
import {
    SSOProtocol,
    SSOProtocolConfigMap,
} from '@/core/domain/auth/interfaces/ssoConfig.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class CreateOrUpdateSSOConfigUseCase {
    constructor(
        @Inject(SSO_CONFIG_SERVICE_TOKEN)
        private readonly ssoConfigService: ISSOConfigService,
    ) {}

    async execute(params: {
        organizationId: string;
        uuid?: string;
        protocol?: SSOProtocol;
        providerConfig?: SSOProtocolConfigMap[SSOProtocol];
        active?: boolean;
        domains?: string[];
    }) {
        const {
            organizationId,
            uuid,
            protocol,
            providerConfig,
            active,
            domains,
        } = params;

        if (uuid) {
            const ssoConfig = await this.ssoConfigService.findOne({
                uuid,
                organization: {
                    uuid: organizationId,
                },
            });

            if (!ssoConfig) {
                throw new Error('SSOConfig not found');
            }

            const updated = await this.ssoConfigService.update(ssoConfig.uuid, {
                protocol,
                providerConfig,
                active,
                domains,
            });

            return updated.toJson();
        }

        if (!protocol || !providerConfig || !domains) {
            throw new Error('Missing required fields');
        }

        const created = await this.ssoConfigService.create({
            protocol,
            providerConfig,
            active,
            organization: {
                uuid: organizationId,
            },
            domains,
        });

        return created.toJson();
    }
}
