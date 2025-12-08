import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    mapSimpleModelToEntity,
    mapSimpleModelsToEntities,
} from '@libs/common/infrastructure/repositories/mappers';
import { IssuesModel } from '@libs/core/database/mongoose/schemas/issues.model';
import { IIssuesRepository } from '@libs/issues/domain/contracts/issues.repository';
import { IssuesEntity } from '@libs/issues/domain/entities/issues.entity';
import { IIssue } from '@libs/issues/domain/interfaces/issues.interface';
import { IssueStatus } from '@libs/common/types/general/issues.type';
import { LabelType } from '@libs/common/utils/codeManagement/labels';
import { SeverityLevel } from '@libs/common/utils/enums/severityLevel.enum';

@Injectable()
export class IssuesRepository implements IIssuesRepository {
    constructor(
        @InjectModel(IssuesModel.name)
        private readonly issuesModel: Model<IssuesModel>,
    ) {}

    getNativeCollection() {
        try {
            return this.issuesModel.db.collection('issues');
        } catch (error) {
            throw error;
        }
    }

    async create(issue: Omit<IIssue, 'uuid'>): Promise<IssuesEntity> {
        try {
            const saved = await this.issuesModel.create(issue);
            return mapSimpleModelToEntity(saved, IssuesEntity);
        } catch (error) {
            throw error;
        }
    }

    async findById(uuid: string): Promise<IssuesEntity | null> {
        try {
            const doc = await this.issuesModel.findById(uuid).exec();
            return doc ? mapSimpleModelToEntity(doc, IssuesEntity) : null;
        } catch (error) {
            throw error;
        }
    }

    async findOne(filter?: Partial<IIssue>): Promise<IssuesEntity | null> {
        try {
            const doc = await this.issuesModel.findOne(filter).exec();
            return doc ? mapSimpleModelToEntity(doc, IssuesEntity) : null;
        } catch (error) {
            throw error;
        }
    }

    async findByFileAndStatus(
        organizationId: string,
        repositoryId: string,
        filePath: string,
        status?: IssueStatus,
    ): Promise<IssuesEntity[] | null> {
        try {
            const issues = await this.issuesModel.find({
                'organizationId': organizationId,
                'repository.id': repositoryId,
                'filePath': filePath,
                'status': status ? status : { $ne: IssueStatus.OPEN },
            });

            return issues
                ? mapSimpleModelsToEntities(issues, IssuesEntity)
                : null;
        } catch (error) {
            throw error;
        }
    }

    async findByFilters(filter?: Partial<IIssue>): Promise<IssuesEntity[]> {
        try {
            let query = this.issuesModel.find(filter);

            const docs = await query.exec();
            return mapSimpleModelsToEntities(docs, IssuesEntity);
        } catch (error) {
            throw error;
        }
    }

    async find(organizationId: string): Promise<IssuesEntity[]> {
        try {
            const docs = await this.issuesModel
                .find({
                    organizationId: organizationId,
                })
                .select({
                    'uuid': 1,
                    'title': 1,
                    'filePath': 1,
                    'label': 1,
                    'severity': 1,
                    'status': 1,
                    'repository.id': 1,
                    'repository.name': 1,
                    'contributingSuggestions': 1,
                    'createdAt': 1,
                    '_id': 1,
                })
                .exec();
            return mapSimpleModelsToEntities(docs, IssuesEntity);
        } catch (error) {
            throw error;
        }
    }

    async count(filter?: Partial<IIssue>): Promise<number> {
        try {
            return await this.issuesModel.countDocuments(filter).exec();
        } catch (error) {
            throw error;
        }
    }

    async findBySuggestionId(
        suggestionId: string,
    ): Promise<IssuesEntity | null> {
        try {
            const doc = await this.issuesModel
                .findOne({
                    contributingSuggestionIds: suggestionId,
                })
                .exec();

            return doc ? mapSimpleModelToEntity(doc, IssuesEntity) : null;
        } catch (error) {
            throw error;
        }
    }

    //#region Update
    async update(
        issue: IssuesEntity,
        updateData: Omit<Partial<IIssue>, 'uuid' | 'id'>,
    ): Promise<IssuesEntity | null> {
        try {
            const doc = await this.issuesModel.findByIdAndUpdate(
                issue.uuid,
                { $set: updateData },
                { new: true },
            );
            return doc ? mapSimpleModelToEntity(doc, IssuesEntity) : null;
        } catch (error) {
            throw error;
        }
    }

    async updateLabel(
        uuid: string,
        label: LabelType,
    ): Promise<IssuesEntity | null> {
        try {
            const doc = await this.issuesModel.findByIdAndUpdate(
                uuid,
                {
                    $set: {
                        'label': label,
                        'representativeSuggestion.label': label,
                    },
                },
                { new: true },
            );
            return doc ? mapSimpleModelToEntity(doc, IssuesEntity) : null;
        } catch (error) {
            throw error;
        }
    }

    async updateSeverity(
        uuid: string,
        severity: SeverityLevel,
    ): Promise<IssuesEntity | null> {
        try {
            const doc = await this.issuesModel.findByIdAndUpdate(
                uuid,
                {
                    $set: {
                        'severity': severity,
                        'representativeSuggestion.severity': severity,
                    },
                },
                { new: true },
            );
            return doc ? mapSimpleModelToEntity(doc, IssuesEntity) : null;
        } catch (error) {
            throw error;
        }
    }

    async updateStatus(
        uuid: string,
        status: IssueStatus,
    ): Promise<IssuesEntity | null> {
        try {
            const doc = await this.issuesModel.findByIdAndUpdate(
                uuid,
                { $set: { status: status } },
                { new: true },
            );
            return doc ? mapSimpleModelToEntity(doc, IssuesEntity) : null;
        } catch (error) {
            throw error;
        }
    }

    async updateStatusByIds(
        uuids: string[],
        status: IssueStatus,
    ): Promise<IssuesEntity[] | null> {
        try {
            await this.issuesModel.updateMany(
                { _id: { $in: uuids } },
                { $set: { status: status } },
            );

            const docs = await this.issuesModel.find({ _id: { $in: uuids } });
            return mapSimpleModelsToEntities(docs, IssuesEntity);
        } catch (error) {
            throw error;
        }
    }
    //#endregion

    async addSuggestionIds(
        uuid: string,
        suggestionIds: string[],
    ): Promise<IssuesEntity | null> {
        try {
            const doc = await this.issuesModel.findByIdAndUpdate(
                uuid,
                {
                    $addToSet: {
                        contributingSuggestionIds: { $each: suggestionIds },
                    },
                },
                { new: true },
            );
            return doc ? mapSimpleModelToEntity(doc, IssuesEntity) : null;
        } catch (error) {
            throw error;
        }
    }
}
