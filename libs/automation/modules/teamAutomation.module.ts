import { UseCases } from '@libs/automation/application/use-cases/team-automation';
import { ActiveCodeManagementTeamAutomationsUseCase } from '@libs/automation/application/use-cases/team-automation/active-code-manegement-automations.use-case';
import { ActiveCodeReviewAutomationUseCase } from '@libs/automation/application/use-cases/team-automation/active-code-review-automation.use-case';
import { TEAM_AUTOMATION_REPOSITORY_TOKEN } from '@libs/automation/domain/contracts/team-automation.repository';
import { TEAM_AUTOMATION_SERVICE_TOKEN } from '@libs/automation/domain/contracts/team-automation.service';
import { TeamAutomationModel } from '@libs/automation/infrastructure/repositories/schemas/teamAutomation.model';
import { TeamAutomationRepository } from '@libs/automation/infrastructure/repositories/teamAutomation.repository';
import { TeamAutomationService } from '@libs/automation/infrastructure/services/team-automation.service';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationModule } from '../automation.module';
import { AutomationStrategyModule } from './automationStrategy.module';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { OrganizationModule } from '@libs/organization/organization.module';
import { PlatformModule } from '@libs/platform/platform.module';
import { ProfileConfigModule } from '@libs/identity/modules/profileConfig.module';
import { TeamsModule } from '@libs/organization/modules/team.module';
import { TeamMembersModule } from '@libs/organization/modules/teamMembers.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([TeamAutomationModel]),
        forwardRef(() => TeamsModule),
        forwardRef(() => AutomationStrategyModule),
        forwardRef(() => AutomationModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => TeamMembersModule),
        forwardRef(() => OrganizationModule),
        forwardRef(() => ProfileConfigModule),
    ],
    providers: [
        ...UseCases,
        {
            provide: TEAM_AUTOMATION_REPOSITORY_TOKEN,
            useClass: TeamAutomationRepository,
        },
        {
            provide: TEAM_AUTOMATION_SERVICE_TOKEN,
            useClass: TeamAutomationService,
        },
        // {
        //     provide: INTEGRATION_SERVICE_TOKEN,
        //     useClass: IntegrationService,
        // },
        // {
        //     provide: INTEGRATION_CONFIG_SERVICE_TOKEN,
        //     useClass: IntegrationConfigService,
        // },
    ],
    controllers: [],
    exports: [
        TEAM_AUTOMATION_REPOSITORY_TOKEN,
        TEAM_AUTOMATION_SERVICE_TOKEN,
        // INTEGRATION_SERVICE_TOKEN,
        // INTEGRATION_CONFIG_SERVICE_TOKEN,
        ActiveCodeManagementTeamAutomationsUseCase,
        ActiveCodeReviewAutomationUseCase,
    ],
})
export class TeamAutomationModule {}
