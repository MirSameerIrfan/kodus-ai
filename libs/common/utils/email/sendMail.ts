import axios from 'axios';
import { SimpleLogger } from '@kodus/flow/dist/observability/logger';

import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';

type CustomerIoEmailPayload = {
    transactional_message_id: string | number;
    to: string;
    from?: string;
    subject?: string;
    message_data?: Record<string, unknown>;
    identifiers?: Record<string, string | number>;
};

const CUSTOMERIO_RULES_TRANSACTIONAL_ID = 14;
const CUSTOMERIO_FORGOT_PASSWORD_TRANSACTIONAL_ID = 11;
const CUSTOMERIO_CONFIRMATION_TRANSACTIONAL_ID = 12;
const CUSTOMERIO_INVITE_TRANSACTIONAL_ID = 13;

const getCustomerIoApiToken = (): string => {
    const apiToken = process.env.API_CUSTOMERIO_APP_API_TOKEN;
    if (!apiToken) {
        throw new Error('API_CUSTOMERIO_APP_API_TOKEN is not set');
    }
    return apiToken;
};

const getCustomerIoBaseUrl = (): string =>
    process.env.API_CUSTOMERIO_BASE_URL || 'https://api.customer.io';

const getTransactionalMessageId = (envKey: string): string | number => {
    const value = process.env[envKey];
    if (!value) {
        throw new Error(`${envKey} is not set`);
    }
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? value : numericValue;
};

const DEFAULT_FROM_EMAIL = 'noreply@kodus.io';
const DEFAULT_FROM_NAME = 'Kody from Kodus';

const getFromAddress = (): string => {
    const fromEmail = process.env.API_CUSTOMERIO_FROM_EMAIL;
    if (!fromEmail) {
        return `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`;
    }
    const fromName = process.env.API_CUSTOMERIO_FROM_NAME;
    return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
};

const applyFromAddress = (
    payload: CustomerIoEmailPayload,
): CustomerIoEmailPayload => {
    const fromAddress = getFromAddress();
    if (fromAddress) {
        payload.from = fromAddress;
    }

    return payload;
};

const buildIdentifiers = (email: string): CustomerIoEmailPayload['identifiers'] => ({
    email,
});

const sendCustomerIoEmail = async (
    payload: CustomerIoEmailPayload,
): Promise<unknown> => {
    const apiToken = getCustomerIoApiToken();
    const baseUrl = getCustomerIoBaseUrl();

    const response = await axios.post(`${baseUrl}/v1/send/email`, payload, {
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
        },
    });

    return response.data;
};

const sendInvite = async (
    user,
    adminUserEmail,
    invite,
    logger?: SimpleLogger,
) => {
    try {
        const transactionalMessageId = CUSTOMERIO_INVITE_TRANSACTIONAL_ID;

        const payload: CustomerIoEmailPayload = {
            transactional_message_id: transactionalMessageId,
            to: user.email,
            subject: `You've been invited to join ${user.teamMember[0].team.name}`,
            identifiers: buildIdentifiers(user.email),
            message_data: {
                organizationName: user.organization.name,
                invitingUser: {
                    email: adminUserEmail,
                },
                teamName: user.teamMember[0].team.name,
                invitedUser: {
                    name: user.teamMember[0].name,
                    invite,
                },
            },
        };

        return await sendCustomerIoEmail(applyFromAddress(payload));
    } catch (error) {
        if (logger) {
            logger.error({
                message: `Error in sendInvite for user ${user?.email}`,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                context: 'sendInvite',
                metadata: {
                    userEmail: user?.email,
                    adminUserEmail,
                    organizationName: user?.organization?.name,
                },
            });
        } else {
            console.log(error);
        }
    }
};

const sendForgotPasswordEmail = async (
    email: string,
    name: string,
    token: string,
    logger?: SimpleLogger,
) => {
    try {
        const webUrl = process.env.API_USER_INVITE_BASE_URL;

        const transactionalMessageId =
            CUSTOMERIO_FORGOT_PASSWORD_TRANSACTIONAL_ID;

        const payload: CustomerIoEmailPayload = {
            transactional_message_id: transactionalMessageId,
            to: email,
            subject: 'Reset your Kodus password',
            identifiers: buildIdentifiers(email),
            message_data: {
                account: {
                    name: email,
                },
                resetLink: `${webUrl}/forgot-password/reset?token=${token}`,
            },
        };

        return await sendCustomerIoEmail(applyFromAddress(payload));
    } catch (error) {
        if (logger) {
            logger.error({
                message: `Error in sendForgotPasswordEmail for ${email}`,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                context: 'sendForgotPasswordEmail',
                metadata: {
                    email,
                    name,
                },
            });
        } else {
            console.error('sendForgotPasswordEmail error:', error);
        }
    }
};

const sendKodyRulesNotification = async (
    users: Array<{ email: string; name: string }>,
    rules: Array<string>,
    organizationName: string,
    logger?: SimpleLogger,
) => {
    try {
        // Limitar regras para máximo 3 itens
        const limitedRules = rules.slice(0, 3);

        // Enviar email para cada usuário individualmente para personalização
        const emailPromises = users.map(async (user) => {
            const transactionalMessageId = CUSTOMERIO_RULES_TRANSACTIONAL_ID;

            const payload: CustomerIoEmailPayload = {
                transactional_message_id: transactionalMessageId,
                to: user.email,
                subject: `New Kody Rules Generated for ${organizationName}`,
                identifiers: buildIdentifiers(user.email),
                message_data: {
                    user: {
                        name: user.name,
                    },
                    organization: {
                        name: organizationName,
                    },
                    rules: limitedRules,
                    rulesCount: rules.length,
                },
            };

            return await sendCustomerIoEmail(applyFromAddress(payload));
        });

        return await Promise.allSettled(emailPromises);
    } catch (error) {
        if (logger) {
            logger.error({
                message: `Error in sendKodyRulesNotification for organization ${organizationName}`,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                context: 'sendKodyRulesNotification',
                metadata: {
                    organizationName,
                    usersCount: users?.length || 0,
                    rulesCount: rules?.length || 0,
                },
            });
        } else {
            console.error('sendKodyRulesNotification error:', error);
        }
        throw error;
    }
};

const sendConfirmationEmail = async (
    token: string,
    email: string,
    organizationName: string,
    organizationAndTeamData: OrganizationAndTeamData,
    logger?: SimpleLogger,
) => {
    try {
        const webUrl = process.env.API_USER_INVITE_BASE_URL;

        const transactionalMessageId =
            CUSTOMERIO_CONFIRMATION_TRANSACTIONAL_ID;

        const payload: CustomerIoEmailPayload = {
            transactional_message_id: transactionalMessageId,
            to: email,
            subject: 'Confirm your email',
            identifiers: buildIdentifiers(email),
            message_data: {
                organizationName: organizationName,
                confirmLink: `${webUrl}/confirm-email?token=${token}`,
            },
        };

        return await sendCustomerIoEmail(applyFromAddress(payload));
    } catch (error) {
        if (logger) {
            logger.error({
                message: `Error in sendConfirmationEmail for user ${email}`,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                context: 'sendConfirmationEmail',
                metadata: {
                    email,
                    organizationName,
                    organizationAndTeamData,
                },
            });
        }
    }
};

export {
    sendConfirmationEmail,
    sendForgotPasswordEmail,
    sendInvite,
    sendKodyRulesNotification,
};
