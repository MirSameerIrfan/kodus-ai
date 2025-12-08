/**
 * Interface and types for license service.
 */

import { OrganizationAndTeamData } from '@libs/common/types/general/organizationAndTeamData';

export enum SubscriptionStatus {
    TRIAL = 'trial',
    ACTIVE = 'active',
    PAYMENT_FAILED = 'payment_failed',
    CANCELED = 'canceled',
    EXPIRED = 'expired',
    SELF_HOSTED = 'self-hosted',
}

export type OrganizationLicenseValidationResult = {
    valid: boolean;
    subscriptionStatus?: SubscriptionStatus;
    trialEnd?: Date;
    numberOfLicenses?: number;
    planType?: string;
};

export type UserWithLicense = {
    git_id: string;
};

export const LICENSE_SERVICE_TOKEN = Symbol('LicenseService');

export interface ILicenseService {
    /**
     * Validate organization license.
     *
     * @param organizationAndTeamData Organization ID and team ID.
     * @returns Promise with validation result.
     */
    validateOrganizationLicense(
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<OrganizationLicenseValidationResult>;

    /**
     * Get all users with license.
     *
     * @param params Organization ID and team ID.
     * @returns Promise with array of users with license.
     */
    getAllUsersWithLicense(
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<UserWithLicense[]>;

    /**
     * Assign license to a user.
     *
     * @param organizationAndTeamData Organization ID and team ID.
     * @param userGitId Git ID of the user to assign license to.
     * @param provider The git provider (e.g., 'github', 'gitlab').
     * @returns Promise with boolean indicating success.
     */
    assignLicense(
        organizationAndTeamData: OrganizationAndTeamData,
        userGitId: string,
        provider: string,
    ): Promise<boolean>;
}
