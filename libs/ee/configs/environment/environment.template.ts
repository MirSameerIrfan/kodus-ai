import { Environment } from './types';

declare const __CLOUD_MODE__: boolean;
declare const __DEVELOPMENT_MODE__: boolean;

export const environment: Environment = {
    API_CLOUD_MODE: __CLOUD_MODE__,
    API_DEVELOPMENT_MODE: __DEVELOPMENT_MODE__,
};
