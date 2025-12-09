import { createLogger } from '@kodus/flow';
import { Injectable, Inject } from '@nestjs/common';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import {
    IIntegrationConfigService,
    INTEGRATION_CONFIG_SERVICE_TOKEN,
} from '@libs/integrations/domain/configs/contracts/integration-config.service.contracts';
import {
    ITeamAutomationService,
    TEAM_AUTOMATION_SERVICE_TOKEN,
} from '@libs/automation/domain/contracts/team-automation.service';
import {
    AUTOMATION_SERVICE_TOKEN,
    IAutomationService,
} from '@libs/automation/domain/contracts/automation.service';
import { AutomationType } from '@libs/automation/domain/enums/automation-type';
import { PlatformType } from '@libs/core/domain/enums/platform-type.enum';
import { IntegrationConfigKey } from '@libs/core/domain/enums/Integration-config-key.enum';
import {
    PermissionValidationService,
    ValidationErrorType,
} from '@libs/ee/shared/services/permissionValidation.service';
import { BYOKConfig } from '@kodus/kodus-common/llm';

export interface FindTeamWithActiveCodeReviewResult {
    organizationAndTeamData: OrganizationAndTeamData;
    automationId: string;
    byokConfig?: BYOKConfig;
}

@Injectable()
export class CodeReviewValidationService {
    private readonly logger = createLogger(CodeReviewValidationService.name);

    constructor(
        @Inject(INTEGRATION_CONFIG_SERVICE_TOKEN)
        private readonly integrationConfigService: IIntegrationConfigService,
        @Inject(AUTOMATION_SERVICE_TOKEN)
        private readonly automationService: IAutomationService,
        @Inject(TEAM_AUTOMATION_SERVICE_TOKEN)
        private readonly teamAutomationService: ITeamAutomationService,
        private readonly permissionValidationService: PermissionValidationService,
    ) {}

    /**
     * Finds team with active code review automation and validates permissions
     * Extracted from RunCodeReviewAutomationUseCase.findTeamWithActiveCodeReview
     */
    async findTeamWithActiveCodeReview(params: {
        repository: { id: string; name: string };
        platformType: PlatformType;
        userGitId?: string;
        prNumber?: number;
        triggerCommentId?: string | number;
    }): Promise<FindTeamWithActiveCodeReviewResult | null> {
        try {
            if (!params?.repository?.id) {
                return null;
            }

            const configs =
                await this.integrationConfigService.findIntegrationConfigWithTeams(
                    IntegrationConfigKey.REPOSITORIES,
                    params.repository.id,
                    params.platformType,
                );

            if (!configs?.length) {
                this.logger.warn({
                    message: 'No repository configuration found',
                    context: CodeReviewValidationService.name,
                    metadata: {
                        repositoryName: params.repository?.name,
                    },
                });

                return null;
            }

            const automation = await this.getAutomation();

            for (const config of configs) {
                const automations = await this.getTeamAutomations(
                    automation.uuid,
                    config.team.uuid,
                );

                if (!automations?.length) {
                    this.logger.warn({
                        message: `No automations configuration found. Organization: ${config?.team?.organization?.uuid} - Team: ${config?.team?.uuid}`,
                        context: CodeReviewValidationService.name,
                        metadata: {
                            repositoryName: params.repository?.name,
                            organizationAndTeamData: {
                                organizationId:
                                    config?.team?.organization?.uuid,
                                teamId: config?.team?.uuid,
                            },
                            automationId: automation.uuid,
                        },
                    });
                } else {
                    const { organizationAndTeamData, automationId } = {
                        organizationAndTeamData: {
                            organizationId: config?.team?.organization?.uuid,
                            teamId: config?.team?.uuid,
                        },
                        automationId: automations[0].uuid,
                    };

                    // Validate permissions using PermissionValidationService
                    const validationResult =
                        await this.permissionValidationService.validateExecutionPermissions(
                            organizationAndTeamData,
                            params?.userGitId,
                            CodeReviewValidationService.name,
                        );

                    if (
                        !validationResult.allowed &&
                        validationResult.errorType !==
                            ValidationErrorType.NOT_ERROR
                    ) {
                        this.logger.warn({
                            message: 'Validation failed',
                            context: CodeReviewValidationService.name,
                            metadata: {
                                organizationAndTeamData,
                                repository: params?.repository,
                                prNumber: params?.prNumber,
                                userGitId: params?.userGitId,
                                errorType: validationResult.errorType,
                            },
                        });

                        return null;
                    } else if (
                        !validationResult.allowed &&
                        validationResult.errorType ===
                            ValidationErrorType.NOT_ERROR
                    ) {
                        return null;
                    }

                    // Extract byokConfig from validation result
                    const byokConfig = validationResult.byokConfig ?? undefined;

                    return {
                        organizationAndTeamData,
                        automationId,
                        byokConfig,
                    };
                }
            }

            return null;
        } catch (error) {
            this.logger.error({
                message: 'Error finding team with active code review',
                context: CodeReviewValidationService.name,
                error: error instanceof Error ? error : undefined,
                metadata: {
                    ...params,
                },
            });
            throw error;
        }
    }

    /**
     * Validates execution permissions for code review
     * Wrapper around PermissionValidationService.validateExecutionPermissions
     */
    async validateExecutionPermissions(
        organizationAndTeamData: OrganizationAndTeamData,
        userGitId?: string,
    ): Promise<{
        allowed: boolean;
        errorType?: ValidationErrorType;
        byokConfig?: BYOKConfig;
    }> {
        const validationResult =
            await this.permissionValidationService.validateExecutionPermissions(
                organizationAndTeamData,
                userGitId,
                CodeReviewValidationService.name,
            );

        return {
            allowed: validationResult.allowed,
            errorType: validationResult.errorType,
            byokConfig: validationResult.byokConfig,
        };
    }

    private async getAutomation() {
        const automation = (
            await this.automationService.find({
                automationType: AutomationType.AUTOMATION_CODE_REVIEW,
            })
        )[0];

        if (!automation) {
            this.logger.warn({
                message: 'No automation found',
                context: CodeReviewValidationService.name,
                metadata: {
                    automationName: 'Code Review',
                },
            });
            throw new Error('No automation found');
        }

        return automation;
    }

    private async getTeamAutomations(automationUuid: string, teamId: string) {
        const teamAutomations = await this.teamAutomationService.find({
            automation: { uuid: automationUuid },
            status: true,
            team: { uuid: teamId },
        });

        if (!teamAutomations || teamAutomations?.length <= 0) {
            this.logger.warn({
                message: 'No active team automation found',
                context: CodeReviewValidationService.name,
                metadata: {
                    automation: automationUuid,
                    teamId: teamId,
                },
            });
            return null;
        }

        return teamAutomations;
    }
}
