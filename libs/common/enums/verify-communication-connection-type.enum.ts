import { IntegrationCategory } from '@libs/common/enums/integration-category.enum';

export type VerifyCommunicationConnectionType = {
    isSetupComplete: boolean;
    hasConnection: boolean;
    config?: object;
    platformName: string;
    category?: IntegrationCategory;
};
