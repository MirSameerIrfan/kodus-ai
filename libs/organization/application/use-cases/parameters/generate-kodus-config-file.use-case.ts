import * as fs from 'node:fs';

import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import * as yaml from 'js-yaml';

import { KodusConfigFile } from '@/config/types/general/codeReview.type';
import {
    CODE_BASE_CONFIG_SERVICE_TOKEN,
    ICodeBaseConfigService,
} from '@/core/domain/codeBase/contracts/CodeBaseConfigService.contract';
import {
    IParametersService,
    PARAMETERS_SERVICE_TOKEN,
} from '@/core/domain/parameters/contracts/parameters.service.contract';
import {
    Action,
    ResourceType,
} from '@/core/domain/permissions/enums/permissions.enum';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { AuthorizationService } from '@/core/infrastructure/adapters/services/permissions/authorization.service';
import { ParametersKey } from '@/shared/domain/enums/parameters-key.enum';

@Injectable()
export class GenerateKodusConfigFileUseCase {
    constructor(
        @Inject(PARAMETERS_SERVICE_TOKEN)
        private readonly parametersService: IParametersService,

        @Inject(CODE_BASE_CONFIG_SERVICE_TOKEN)
        private readonly codeBaseConfigService: ICodeBaseConfigService,

        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string }; uuid: string };
        },

        private readonly logger: PinoLoggerService,

        private readonly authorizationService: AuthorizationService,
    ) {}

    async execute(
        teamId: string,
        repositoryId?: string,
        directoryId?: string,
    ): Promise<{ yamlString?: string }> {
        try {
            const organizationId = this.request.user?.organization.uuid;
            const organizationAndTeamData = {
                organizationId: organizationId,
                teamId,
            };

            if (repositoryId && repositoryId !== 'global') {
                await this.authorizationService.ensure({
                    user: this.request.user,
                    action: Action.Read,
                    resource: ResourceType.CodeReviewSettings,
                    repoIds: [repositoryId],
                });
            }

            if (!repositoryId || repositoryId === 'global') {
                return this.getKodyConfigFile();
            }

            const codeReviewConfigs = await this.parametersService.findByKey(
                ParametersKey.CODE_REVIEW_CONFIG,
                organizationAndTeamData,
            );

            const codeReviewRepositories =
                codeReviewConfigs.configValue.repositories;

            const repository = codeReviewRepositories.find(
                (repository) => repository.id === repositoryId,
            );

            const directory = directoryId
                ? repository?.directories?.find(
                      (directory) => directory.id === directoryId,
                  )
                : undefined;

            return this.getKodyConfigFile(
                (directory?.configs || repository?.configs) as KodusConfigFile,
            );
        } catch (error) {
            this.logger.error({
                message: 'Failed to generate Kodus config file!',
                context: GenerateKodusConfigFileUseCase.name,
                error: error,
                metadata: {
                    parametersKey: ParametersKey.CODE_REVIEW_CONFIG,
                    teamId,
                    repositoryId,
                },
            });
            throw new Error(
                `Failed to generate Kodus config file for team ${teamId}${repositoryId ? ` and repository ${repositoryId}` : ''}: ${error.message}`,
            );
        }
    }

    private getKodyConfigFile(configObject?: KodusConfigFile): {
        yamlString: string;
    } {
        let yamlString: string;

        if (configObject) {
            yamlString = yaml.dump(configObject);
        } else {
            const kodusDefaultConfigYMLfile = yaml.load(
                fs.readFileSync('default-kodus-config.yml', 'utf8'),
            ) as KodusConfigFile;
            yamlString = yaml.dump(kodusDefaultConfigYMLfile);
        }

        return { yamlString };
    }
}
