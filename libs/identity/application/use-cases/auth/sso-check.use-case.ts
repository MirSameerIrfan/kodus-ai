import {
    ISSOConfigService,
    SSO_CONFIG_SERVICE_TOKEN,
} from '@libs/identity/domain/sso/contracts/ssoConfig.service.contract';
import { SSOProtocol } from '@libs/identity/domain/sso/interfaces/ssoConfig.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class SSOCheckUseCase {
    constructor(
        @Inject(SSO_CONFIG_SERVICE_TOKEN)
        private readonly ssoConfigService: ISSOConfigService,
    ) {}

    async execute(domain: string) {
        const ssoConfig = await this.ssoConfigService.findOne({
            protocol: SSOProtocol.SAML,
            domains: [domain],
        });

        if (!ssoConfig) {
            return {
                active: false,
                organizationId: null,
            };
        }

        return {
            active: ssoConfig.active,
            organizationId: ssoConfig.toJson().organization.uuid,
        };
    }
}
