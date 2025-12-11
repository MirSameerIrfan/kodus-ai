import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UseCases } from '@libs/automation/application/use-cases/teamAutomation';
import { ActiveCodeManagementTeamAutomationsUseCase } from '@libs/automation/application/use-cases/teamAutomation/active-code-manegement-automations.use-case';
import { ActiveCodeReviewAutomationUseCase } from '@libs/automation/application/use-cases/teamAutomation/active-code-review-automation.use-case';
import { TEAM_AUTOMATION_REPOSITORY_TOKEN } from '@libs/automation/domain/contracts/team-automation.repository';
import { TEAM_AUTOMATION_SERVICE_TOKEN } from '@libs/automation/domain/contracts/team-automation.service';
import { TeamAutomationModel } from '@libs/automation/infrastructure/adapters/repositories/schemas/teamAutomation.model';
import { TeamAutomationRepository } from '@libs/automation/infrastructure/adapters/repositories/teamAutomation.repository';
import { TeamAutomationService } from '@libs/automation/infrastructure/adapters/services/team-automation.service';
import { ProfileConfigModule } from '@libs/identity/modules/profileConfig.module';
import { IntegrationCoreModule } from '@libs/integrations/modules/integrations-core.module';
import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { TeamCoreModule } from '@libs/organization/modules/team-core.module';
import { TeamMembersCoreModule } from '@libs/organization/modules/teamMembers-core.module';
import { OrganizationCoreModule } from '@libs/organization/modules/organization-core.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';

import { AutomationStrategyModule } from './automationStrategy.module';
import { AutomationModule } from '../automation.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([TeamAutomationModel]),
        forwardRef(() => TeamCoreModule),
        forwardRef(() => AutomationStrategyModule),
        forwardRef(() => AutomationModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => IntegrationCoreModule),
        forwardRef(() => IntegrationConfigCoreModule),
        forwardRef(() => TeamMembersCoreModule),
        forwardRef(() => OrganizationCoreModule),
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
    ],
    controllers: [],
    exports: [
        TEAM_AUTOMATION_REPOSITORY_TOKEN,
        TEAM_AUTOMATION_SERVICE_TOKEN,
        ActiveCodeManagementTeamAutomationsUseCase,
        ActiveCodeReviewAutomationUseCase,
    ],
})
export class TeamAutomationModule {}
