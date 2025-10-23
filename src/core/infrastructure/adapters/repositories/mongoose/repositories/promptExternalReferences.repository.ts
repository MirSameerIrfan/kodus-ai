import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IPromptExternalReferenceRepository } from '@/core/domain/prompts/contracts/promptExternalReferenceRepository.contract';
import { PromptExternalReferenceEntity } from '@/core/domain/prompts/entities/promptExternalReference.entity';
import {
    IPromptExternalReference,
    PromptSourceType,
    PromptProcessingStatus,
} from '@/core/domain/prompts/interfaces/promptExternalReference.interface';
import { PromptExternalReferencesModel } from '../schema/promptExternalReferences.model';
import {
    mapSimpleModelToEntity,
    mapSimpleModelsToEntities,
} from '@/shared/infrastructure/repositories/mappers';

@Injectable()
export class PromptExternalReferencesRepository
    implements IPromptExternalReferenceRepository
{
    constructor(
        @InjectModel(PromptExternalReferencesModel.name)
        private readonly model: Model<PromptExternalReferencesModel>,
    ) {}

    async create(
        data: Partial<IPromptExternalReference>,
    ): Promise<PromptExternalReferenceEntity> {
        const created = await this.model.create(data);
        return mapSimpleModelToEntity(created, PromptExternalReferenceEntity);
    }

    async findByConfigKey(
        configKey: string,
        sourceType: PromptSourceType,
    ): Promise<PromptExternalReferenceEntity | null> {
        const doc = await this.model
            .findOne({
                configKey,
                sourceType,
            })
            .lean()
            .exec();

        if (!doc) {
            return null;
        }

        return mapSimpleModelToEntity(doc, PromptExternalReferenceEntity);
    }

    async findByConfigKeys(
        configKeys: string[],
    ): Promise<PromptExternalReferenceEntity[]> {
        const docs = await this.model
            .find({
                configKey: { $in: configKeys },
            })
            .lean()
            .exec();

        return mapSimpleModelsToEntities(docs, PromptExternalReferenceEntity);
    }

    async findByConfigKeyAndSourceTypes(
        configKey: string,
        sourceTypes: PromptSourceType[],
    ): Promise<PromptExternalReferenceEntity[]> {
        const docs = await this.model
            .find({
                configKey,
                sourceType: { $in: sourceTypes },
            })
            .lean()
            .exec();

        return mapSimpleModelsToEntities(docs, PromptExternalReferenceEntity);
    }

    async upsert(
        data: Partial<IPromptExternalReference>,
    ): Promise<PromptExternalReferenceEntity> {
        const { configKey, sourceType } = data;

        if (!configKey || !sourceType) {
            throw new Error('configKey and sourceType are required for upsert');
        }

        const updated = await this.model
            .findOneAndUpdate(
                { configKey, sourceType },
                {
                    $set: {
                        ...data,
                        updatedAt: new Date(),
                    },
                },
                { upsert: true, new: true },
            )
            .exec();

        return mapSimpleModelToEntity(updated, PromptExternalReferenceEntity);
    }

    async update(
        uuid: string,
        data: Partial<IPromptExternalReference>,
    ): Promise<PromptExternalReferenceEntity | null> {
        const updated = await this.model
            .findByIdAndUpdate(
                uuid,
                {
                    $set: {
                        ...data,
                        updatedAt: new Date(),
                    },
                },
                { new: true },
            )
            .exec();

        if (!updated) {
            return null;
        }

        return mapSimpleModelToEntity(updated, PromptExternalReferenceEntity);
    }

    async delete(uuid: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(uuid).exec();
        return !!result;
    }

    async findByOrganizationId(
        organizationId: string,
    ): Promise<PromptExternalReferenceEntity[]> {
        const docs = await this.model.find({ organizationId }).lean().exec();
        return mapSimpleModelsToEntities(docs, PromptExternalReferenceEntity);
    }

    async updateStatus(
        configKey: string,
        sourceType: PromptSourceType,
        status: PromptProcessingStatus,
    ): Promise<PromptExternalReferenceEntity | null> {
        const updated = await this.model
            .findOneAndUpdate(
                { configKey, sourceType },
                {
                    $set: {
                        processingStatus: status,
                        updatedAt: new Date(),
                    },
                },
                { new: true },
            )
            .exec();

        if (!updated) {
            return null;
        }

        return mapSimpleModelToEntity(updated, PromptExternalReferenceEntity);
    }
}
