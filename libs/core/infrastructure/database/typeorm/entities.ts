import { DryRunModel } from '../../../../dryRun/infrastructure/adapters/repositories/schemas/dryRun.model';
import { TeamModel } from '../../../../organization/infrastructure/adapters/repositories/schemas/team.model';
import { OrganizationModel } from '../../../../organization/infrastructure/adapters/repositories/schemas/organization.model';
import { UserModel } from '../../../../identity/infrastructure/adapters/repositories/schemas/user.model';
import { ContextReferenceModel } from '../../../../ai-engine/infrastructure/adapters/repositories/schemas/contextReference.model';
import { SuggestionEmbeddedModel } from '../../../../kodyFineTuning/infrastructure/adapters/repositories/schemas/suggestionEmbedded.model';
import { AuthIntegrationModel } from '../../../../integrations/infrastructure/adapters/repositories/schemas/authIntegration.model';
import { PullRequestsModel } from '../../../../platformData/infrastructure/adapters/repositories/schemas/pullRequests.model';
import { ParametersModel } from '../../../../organization/infrastructure/adapters/repositories/schemas/parameters.model';
import { ObservabilityTelemetryModel } from '../../../../analytics/infrastructure/adapters/repositories/schemas/observabilityTelemetry.model';
import { AuthModel } from '../../../../identity/infrastructure/adapters/repositories/schemas/auth.model';
import { TeamMemberModel } from '../../../../organization/infrastructure/adapters/repositories/schemas/teamMember.model';
import { TeamCliKeyModel } from '../../../../organization/infrastructure/adapters/repositories/schemas/team-cli-key.model';
import { IntegrationConfigModel } from '../../../../integrations/infrastructure/adapters/repositories/schemas/integrationConfig.model';
import { OutboxMessageModel } from '../../../workflow/infrastructure/repositories/schemas/outbox-message.model';
import { CodeReviewSettingsLogModel } from '../../../../ee/codeReviewSettingsLog/infrastructure/adapters/repository/schemas/codeReviewSettingsLog.model';
import { AutomationModel } from '../../../../automation/infrastructure/adapters/repositories/schemas/automation.model';
import { OrganizationParametersModel } from '../../../../organization/infrastructure/adapters/repositories/schemas/organizationParameters.model';
import { GlobalParametersModel } from '../../../../organization/infrastructure/adapters/repositories/schemas/global-parameters.model';
import { TeamAutomationModel } from '../../../../automation/infrastructure/adapters/repositories/schemas/teamAutomation.model';
import { PermissionsModel } from '../../../../identity/infrastructure/adapters/repositories/schemas/permissions.model';
import { IssuesModel } from '../../../../issues/infrastructure/adapters/repositories/schemas/issues.model';
import { AutomationExecutionModel } from '../../../../automation/infrastructure/adapters/repositories/schemas/automationExecution.model';
import { ProfileConfigModel } from '../../../../identity/infrastructure/adapters/repositories/schemas/profileConfig.model';
import { IntegrationModel } from '../../../../integrations/infrastructure/adapters/repositories/schemas/integration.model';
import { KodyRulesModel } from '../../../../kodyRules/infrastructure/adapters/repositories/schemas/kodyRules.model';
import { SSOConfigModel } from '../../../../identity/infrastructure/adapters/repositories/schemas/ssoConfig.model';
import { ProfileModel } from '../../../../identity/infrastructure/adapters/repositories/schemas/profile.model';
import { CodeReviewExecutionModel } from '../../../../automation/infrastructure/adapters/repositories/schemas/codeReviewExecution.model';
import { InteractionModel } from '../../../../analytics/infrastructure/adapters/repositories/schemas/interaction.model';
import { WorkflowJobModel } from '../../../workflow/infrastructure/repositories/schemas/workflow-job.model';
import { InboxMessageModel } from '../../../workflow/infrastructure/repositories/schemas/inbox-message.model';

export const ENTITIES = [
    DryRunModel,
    TeamModel,
    OrganizationModel,
    UserModel,
    ContextReferenceModel,
    SuggestionEmbeddedModel,
    AuthIntegrationModel,
    PullRequestsModel,
    ParametersModel,
    ObservabilityTelemetryModel,
    AuthModel,
    TeamMemberModel,
    TeamCliKeyModel,
    IntegrationConfigModel,
    OutboxMessageModel,
    CodeReviewSettingsLogModel,
    AutomationModel,
    OrganizationParametersModel,
    WorkflowJobModel,
    InboxMessageModel,
    GlobalParametersModel,
    TeamAutomationModel,
    PermissionsModel,
    IssuesModel,
    AutomationExecutionModel,
    ProfileConfigModel,
    IntegrationModel,
    KodyRulesModel,
    SSOConfigModel,
    ProfileModel,
    CodeReviewExecutionModel,
    InteractionModel,
];
