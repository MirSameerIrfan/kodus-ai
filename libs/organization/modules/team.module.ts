import { UseCases } from '@libs/core/application/use-cases/team';
import { CreateTeamUseCase } from '@libs/core/application/use-cases/team/create.use-case';
import { TEAM_REPOSITORY_TOKEN } from '@libs/core/domain/team/contracts/team.repository.contract';
import { TEAM_SERVICE_TOKEN } from '@libs/core/domain/team/contracts/team.service.contract';
import { TeamModel } from '@libs/core/infrastructure/adapters/repositories/typeorm/schema/team.model';
import { TeamDatabaseRepository } from '@libs/core/infrastructure/adapters/repositories/typeorm/team.repository';
import { TeamService } from '@libs/core/infrastructure/adapters/services/team.service';
import { TeamController } from '@libs/core/infrastructure/http/controllers/team.controller';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileConfigModule } from '@libs/identity/modules/profileConfig.module';
import { UsersModule } from '@libs/user.module';
import { OrganizationParametersModule } from '@libs/organizationParameters.module';
import { OrganizationParametersService } from '@libs/core/infrastructure/adapters/services/organizationParameters.service';
import { PromptService } from '@libs/core/infrastructure/adapters/services/prompt.service';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { CreateOrUpdateParametersUseCase } from '@libs/core/application/use-cases/parameters/create-or-update-use-case';
import { ParametersModule } from '@libs/parameters.module';

import { PlatformIntegrationFactory } from '@libs/core/infrastructure/adapters/services/platformIntegration/platformIntegration.factory';
import { IntegrationModel } from '@libs/core/infrastructure/adapters/repositories/typeorm/schema/integration.model';

@Module({
    imports: [
        TypeOrmModule.forFeature([TeamModel, IntegrationModel]),
        forwardRef(() => ProfileConfigModule),
        forwardRef(() => UsersModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => ParametersModule),
    ],
    providers: [
        ...UseCases,
        CreateOrUpdateParametersUseCase,
        OrganizationParametersService,
        PlatformIntegrationFactory,
        PromptService,
        TeamService,
        {
            provide: TEAM_SERVICE_TOKEN,
            useClass: TeamService,
        },
        {
            provide: TEAM_REPOSITORY_TOKEN,
            useClass: TeamDatabaseRepository,
        },
    ],
    exports: [TEAM_SERVICE_TOKEN, TEAM_REPOSITORY_TOKEN, CreateTeamUseCase],
    controllers: [TeamController],
})
export class TeamsModule {}
