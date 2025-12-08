import { createLogger } from '@kodus/flow';
import { IWebhookLogRepository } from '@libs/platform/domain/webhook-log/contracts/webhook-log.repository.contract';
import { IWebhookLog } from '@libs/platform/domain/webhook-log/interfaces/webhook-log.interface';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { WebhookLogModel } from '@core/database/mongoose/schemas/webhook-log.model';
import { Model } from 'mongoose';
import { WebhookLogEntity } from '@libs/platform/domain/webhook-log/entities/webhook-log.entity';
import {
    mapSimpleModelsToEntities,
    mapSimpleModelToEntity,
} from '@shared/infrastructure/repositories/mappers';

@Injectable()
export class WebhookLogRepository implements IWebhookLogRepository {
    private readonly logger = createLogger(WebhookLogRepository.name);
    constructor(
        @InjectModel(WebhookLogModel.name)
        private readonly webhookLogModel: Model<WebhookLogModel>,
    ) {}

    async create(
        data: Omit<IWebhookLog, 'uuid' | 'createdAt' | 'updatedAt'>,
    ): Promise<WebhookLogEntity | null> {
        try {
            const createdLog = await this.webhookLogModel.create(data);

            if (!createdLog) {
                return null;
            }

            return mapSimpleModelToEntity(createdLog, WebhookLogEntity);
        } catch (error) {
            this.logger.error({
                message: 'Error creating webhook log',
                error,
                context: WebhookLogRepository.name,
                metadata: { data },
            });

            return null;
        }
    }

    async update(
        uuid: string,
        data: Partial<Omit<IWebhookLog, 'uuid' | 'createdAt' | 'updatedAt'>>,
    ): Promise<WebhookLogEntity | null> {
        try {
            const updatedLog = await this.webhookLogModel.findOneAndUpdate(
                { uuid },
                { $set: data },
                { new: true },
            );

            if (!updatedLog) {
                return null;
            }

            return mapSimpleModelToEntity(updatedLog, WebhookLogEntity);
        } catch (error) {
            this.logger.error({
                message: 'Error updating webhook log',
                error,
                context: WebhookLogRepository.name,
                metadata: { uuid, data },
            });

            return null;
        }
    }

    async find(filter: Partial<IWebhookLog>): Promise<WebhookLogEntity[]> {
        try {
            const logs = await this.webhookLogModel.find(filter).exec();

            if (!logs || logs.length === 0) {
                return [];
            }

            return mapSimpleModelsToEntities(logs, WebhookLogEntity);
        } catch (error) {
            this.logger.error({
                message: 'Error finding webhook logs',
                error,
                context: WebhookLogRepository.name,
                metadata: { filter },
            });

            return [];
        }
    }

    async findOne(
        filter: Partial<IWebhookLog>,
    ): Promise<WebhookLogEntity | null> {
        try {
            const log = await this.webhookLogModel.findOne(filter).exec();

            if (!log) {
                return null;
            }

            return mapSimpleModelToEntity(log, WebhookLogEntity);
        } catch (error) {
            this.logger.error({
                message: 'Error finding webhook log',
                error,
                context: WebhookLogRepository.name,
                metadata: { filter },
            });

            return null;
        }
    }

    async delete(uuid: string): Promise<void> {
        try {
            await this.webhookLogModel.deleteOne({ uuid }).exec();
        } catch (error) {
            this.logger.error({
                message: 'Error deleting webhook log',
                error,
                context: WebhookLogRepository.name,
                metadata: { uuid },
            });
        }
    }
}
