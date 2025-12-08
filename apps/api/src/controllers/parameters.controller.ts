import { CreateOrUpdateParametersUseCase } from '@libs/organization/application/use-cases/parameters/create-or-update-use-case';
import { FindByKeyParametersUseCase } from '@libs/organization/application/use-cases/parameters/find-by-key-use-case';
import { UpdateCodeReviewParameterRepositoriesUseCase } from '@libs/organization/application/use-cases/parameters/update-code-review-parameter-repositories-use-case';
import { UpdateOrCreateCodeReviewParameterUseCase } from '@libs/organization/application/use-cases/update-or-create-code-review-parameter-use-case';

import { ParametersKey } from '@shared/domain/enums/parameters-key.enum';
import {
    Body,
    Controller,
    Get,
    Inject,
    Post,
    Query,
    Res,
    UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ListCodeReviewAutomationLabelsWithStatusUseCase } from '@libs/organization/application/use-cases/parameters/list-code-review-automation-labels-with-status.use-case';

import { CreateOrUpdateCodeReviewParameterDto } from '../dtos/create-or-update-code-review-parameter.dto';
import { GenerateKodusConfigFileUseCase } from '@libs/organization/application/use-cases/parameters/generate-kodus-config-file.use-case';
import { DeleteRepositoryCodeReviewParameterDto } from '../dtos/delete-repository-code-review-parameter.dto';
import { DeleteRepositoryCodeReviewParameterUseCase } from '@libs/organization/application/use-cases/parameters/delete-repository-code-review-parameter.use-case';
import { PreviewPrSummaryDto } from '../dtos/preview-pr-summary.dto';
import { PreviewPrSummaryUseCase } from '@libs/organization/application/use-cases/parameters/preview-pr-summary.use-case';
import { CodeReviewVersion } from '@shared/types/general/codeReview.type';
import {
    CheckPolicies,
    PolicyGuard,
} from '@libs/identity/infrastructure/permissions/policy.guard';
import {
    checkPermissions,
    checkRepoPermissions,
} from '@libs/identity/infrastructure/permissions/policy.handlers';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { GetDefaultConfigUseCase } from '@libs/organization/application/use-cases/parameters/get-default-config.use-case';
import { GetCodeReviewParameterUseCase } from '@libs/organization/application/use-cases/parameters/get-code-review-parameter.use-case';
import { REQUEST } from '@nestjs/core';
import { UserRequest } from '@shared/types/http/user-request.type';

@Controller('parameters')
export class ParametersController {
    constructor(
        @Inject(REQUEST)
        private readonly request: UserRequest,

        private readonly createOrUpdateParametersUseCase: CreateOrUpdateParametersUseCase,
        private readonly findByKeyParametersUseCase: FindByKeyParametersUseCase,
        private readonly updateOrCreateCodeReviewParameterUseCase: UpdateOrCreateCodeReviewParameterUseCase,
        private readonly updateCodeReviewParameterRepositoriesUseCase: UpdateCodeReviewParameterRepositoriesUseCase,
        private readonly generateKodusConfigFileUseCase: GenerateKodusConfigFileUseCase,
        private readonly deleteRepositoryCodeReviewParameterUseCase: DeleteRepositoryCodeReviewParameterUseCase,
        private readonly previewPrSummaryUseCase: PreviewPrSummaryUseCase,
        private readonly listCodeReviewAutomationLabelsWithStatusUseCase: ListCodeReviewAutomationLabelsWithStatusUseCase,
        private readonly getDefaultConfigUseCase: GetDefaultConfigUseCase,
        private readonly getCodeReviewParameterUseCase: GetCodeReviewParameterUseCase,
    ) {}

    //#region Parameters
    @Post('/create-or-update')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions(Action.Create, ResourceType.CodeReviewSettings),
    )
    public async createOrUpdate(
        @Body()
        body: {
            key: ParametersKey;
            configValue: any;
            organizationAndTeamData: { organizationId: string; teamId: string };
        },
    ) {
        return await this.createOrUpdateParametersUseCase.execute(
            body.key,
            body.configValue,
            body.organizationAndTeamData,
        );
    }

    @Get('/find-by-key')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions(Action.Read, ResourceType.CodeReviewSettings),
    )
    public async findByKey(
        @Query('key') key: ParametersKey,
        @Query('teamId') teamId: string,
    ) {
        return await this.findByKeyParametersUseCase.execute(key, { teamId });
    }

    //endregion
    //#region Code review routes

    @Get('/list-code-review-automation-labels')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions(Action.Read, ResourceType.CodeReviewSettings),
    )
    public async listCodeReviewAutomationLabels(
        @Query('codeReviewVersion') codeReviewVersion?: CodeReviewVersion,
        @Query('teamId') teamId?: string,
        @Query('repositoryId') repositoryId?: string,
    ) {
        return this.listCodeReviewAutomationLabelsWithStatusUseCase.execute({
            codeReviewVersion,
            teamId,
            repositoryId,
        });
    }

    @Post('/create-or-update-code-review')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions(Action.Create, ResourceType.CodeReviewSettings),
    )
    public async updateOrCreateCodeReviewParameter(
        @Body()
        body: CreateOrUpdateCodeReviewParameterDto,
    ) {
        return await this.updateOrCreateCodeReviewParameterUseCase.execute(
            body,
        );
    }

    @Post('/update-code-review-parameter-repositories')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions(Action.Create, ResourceType.CodeReviewSettings),
    )
    public async UpdateCodeReviewParameterRepositories(
        @Body()
        body: {
            organizationAndTeamData: { organizationId: string; teamId: string };
        },
    ) {
        return await this.updateCodeReviewParameterRepositoriesUseCase.execute(
            body,
        );
    }

    @Get('/code-review-parameter')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions(Action.Read, ResourceType.CodeReviewSettings),
    )
    public async getCodeReviewParameter(@Query('teamId') teamId: string) {
        return await this.getCodeReviewParameterUseCase.execute(
            this.request.user,
            teamId,
        );
    }

    @Get('/default-code-review-parameter')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions(Action.Read, ResourceType.CodeReviewSettings),
    )
    public async getDefaultConfig() {
        return await this.getDefaultConfigUseCase.execute();
    }

    @Get('/generate-kodus-config-file')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions(Action.Read, ResourceType.CodeReviewSettings),
    )
    public async GenerateKodusConfigFile(
        @Res() response: Response,
        @Query('teamId') teamId: string,
        @Query('repositoryId') repositoryId?: string,
        @Query('directoryId') directoryId?: string,
    ) {
        const { yamlString } =
            await this.generateKodusConfigFileUseCase.execute(
                teamId,
                repositoryId,
                directoryId,
            );

        response.set({
            'Content-Type': 'application/x-yaml',
            'Content-Disposition': 'attachment; filename=kodus-config.yml',
        });

        return response.send(yamlString);
    }

    @Post('/delete-repository-code-review-parameter')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkRepoPermissions(Action.Delete, ResourceType.CodeReviewSettings, {
            key: {
                body: 'repositoryId',
            },
        }),
    )
    public async deleteRepositoryCodeReviewParameter(
        @Body()
        body: DeleteRepositoryCodeReviewParameterDto,
    ) {
        return this.deleteRepositoryCodeReviewParameterUseCase.execute(body);
    }
    //#endregion

    @Post('/preview-pr-summary')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions(Action.Read, ResourceType.CodeReviewSettings),
    )
    public async previewPrSummary(
        @Body()
        body: PreviewPrSummaryDto,
    ) {
        return this.previewPrSummaryUseCase.execute(body);
    }
}
