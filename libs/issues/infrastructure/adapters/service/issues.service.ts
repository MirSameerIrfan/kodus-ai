import { Injectable, Inject } from '@nestjs/common';

import { GetIssuesByFiltersDto } from '@libs/core/domain/dtos/get-issues-by-filters.dto';
import { IssueStatus } from '@libs/core/infrastructure/config/types/general/issues.type';

import {
    IIssuesRepository,
    ISSUES_REPOSITORY_TOKEN,
} from '@libs/issues/domain/contracts/issues.repository';
import { IIssuesService } from '@libs/issues/domain/contracts/issues.service.contract';
import { IssuesEntity } from '@libs/issues/domain/entities/issues.entity';
import { IIssue } from '@libs/issues/domain/interfaces/issues.interface';
import { LabelType } from '@libs/common/utils/codeManagement/labels';
import { SeverityLevel } from '@libs/common/utils/enums/severityLevel.enum';

@Injectable()
export class IssuesService implements IIssuesService {
    constructor(
        @Inject(ISSUES_REPOSITORY_TOKEN)
        private readonly issuesRepository: IIssuesRepository,
    ) {}

    getNativeCollection() {
        return this.issuesRepository.getNativeCollection();
    }

    async create(issue: Omit<IIssue, 'uuid'>): Promise<IssuesEntity> {
        return this.issuesRepository.create(issue);
    }

    //#region Find
    async findByFileAndStatus(
        organizationId: string,
        repositoryId: string,
        filePath: string,
        status?: IssueStatus,
    ): Promise<IssuesEntity[] | null> {
        return this.issuesRepository.findByFileAndStatus(
            organizationId,
            repositoryId,
            filePath,
            status,
        );
    }

    async findById(uuid: string): Promise<IssuesEntity | null> {
        return await this.issuesRepository.findById(uuid);
    }

    async findOne(filter?: Partial<IIssue>): Promise<IssuesEntity | null> {
        return this.issuesRepository.findOne(filter);
    }

    async find(organizationId: string): Promise<IssuesEntity[]> {
        return await this.issuesRepository.find(organizationId);
    }

    async findByFilters(
        filter?: GetIssuesByFiltersDto,
    ): Promise<IssuesEntity[]> {
        return await this.issuesRepository.findByFilters(filter);
    }

    async count(filter?: GetIssuesByFiltersDto): Promise<number> {
        return await this.issuesRepository.count(filter);
    }
    //#endregion

    //#region Update
    async update(
        issue: IssuesEntity,
        updateData: Partial<IIssue>,
    ): Promise<IssuesEntity | null> {
        return this.issuesRepository.update(issue, updateData);
    }

    async updateLabel(
        uuid: string,
        label: LabelType,
    ): Promise<IssuesEntity | null> {
        return this.issuesRepository.updateLabel(uuid, label);
    }

    async updateSeverity(
        uuid: string,
        severity: SeverityLevel,
    ): Promise<IssuesEntity | null> {
        return this.issuesRepository.updateSeverity(uuid, severity);
    }
    async updateStatus(
        uuid: string,
        status: IssueStatus,
    ): Promise<IssuesEntity | null> {
        return this.issuesRepository.updateStatus(uuid, status);
    }

    async updateStatusByIds(
        uuids: string[],
        status: IssueStatus,
    ): Promise<IssuesEntity[] | null> {
        return this.issuesRepository.updateStatusByIds(uuids, status);
    }
    //#endregion

    async addSuggestionIds(
        uuid: string,
        suggestionIds: string[],
    ): Promise<IssuesEntity | null> {
        return this.issuesRepository.addSuggestionIds(uuid, suggestionIds);
    }
}
