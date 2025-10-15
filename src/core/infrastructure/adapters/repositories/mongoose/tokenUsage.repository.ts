import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LogModel } from '@/core/infrastructure/adapters/repositories/mongoose/schema/log.model';
import { ITokenUsageRepository } from '@/core/domain/tokenUsage/contracts/tokenUsage.repository.contract';
import { ObservabilityTelemetryModel } from './schema/observabilityTelemetry.model';
import {
    TokenUsageQueryContract,
    DailyUsageResultContract,
    UsageSummaryContract,
    UsageByPrResultContract,
    DailyUsageByPrResultContract,
} from '@/core/domain/tokenUsage/types/tokenUsage.types';

@Injectable()
export class TokenUsageRepository implements ITokenUsageRepository {
    private readonly GROUP_ACCUMULATORS = {
        input: {
            $sum: {
                $ifNull: [
                    {
                        $getField: {
                            field: 'gen_ai.usage.input_tokens',
                            input: '$attributes',
                        },
                    },
                    0,
                ],
            },
        },
        output: {
            $sum: {
                $ifNull: [
                    {
                        $getField: {
                            field: 'gen_ai.usage.output_tokens',
                            input: '$attributes',
                        },
                    },
                    0,
                ],
            },
        },
        total: {
            $sum: {
                $ifNull: [
                    {
                        $getField: {
                            field: 'gen_ai.usage.total_tokens',
                            input: '$attributes',
                        },
                    },
                    0,
                ],
            },
        },
        outputReasoning: {
            $sum: {
                $ifNull: [
                    {
                        $getField: {
                            field: 'gen_ai.usage.reasoning_tokens',
                            input: '$attributes',
                        },
                    },
                    0,
                ],
            },
        },
    };

    private readonly GROUP_ACCUMULATORS_PROJECT_STAGE = Object.keys(
        this.GROUP_ACCUMULATORS,
    ).reduce((acc, key) => ({ ...acc, [key]: `$${key}` }), {});

    constructor(
        @InjectModel(ObservabilityTelemetryModel.name)
        private readonly observabilityTelemetryModel: Model<ObservabilityTelemetryModel>,
    ) {}

    private _createUsageAggregationPipeline(params: {
        query: TokenUsageQueryContract;
        groupById?: any;
        projectStage?: Record<string, any>;
        sortStage?: Record<string, any>;
        extraMatch?: Record<string, any>;
    }): any[] {
        const {
            query,
            groupById,
            projectStage,
            sortStage,
            extraMatch = {},
        } = params;

        const matchStage: Record<string, any> = {
            'attributes.organizationId': query.organizationId,
            'timestamp': {
                $gte: query.start,
                $lte: query.end,
            },
            ...extraMatch,
        };

        if (query.prNumber) {
            matchStage['attributes.prNumber'] = query.prNumber;
        }

        const pipeline: any[] = [
            { $match: matchStage },
            { $group: { _id: groupById, ...this.GROUP_ACCUMULATORS } },
            { $project: projectStage },
        ];

        if (sortStage) {
            pipeline.push({ $sort: sortStage });
        }

        return pipeline;
    }

    async getSummary(
        query: TokenUsageQueryContract,
    ): Promise<UsageSummaryContract> {
        const pipeline = this._createUsageAggregationPipeline({
            query,
            projectStage: {
                _id: 0,
                ...this.GROUP_ACCUMULATORS_PROJECT_STAGE,
            },
        });

        const results = await this.observabilityTelemetryModel
            .aggregate<UsageSummaryContract>(pipeline)
            .exec();

        if (results.length > 0) {
            return results[0];
        }

        return { input: 0, output: 0, total: 0, outputReasoning: 0 };
    }

    async getDailyUsage(
        query: TokenUsageQueryContract,
    ): Promise<DailyUsageResultContract[]> {
        const pipeline = this._createUsageAggregationPipeline({
            query,
            groupById: {
                $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$timestamp',
                    timezone: query.timezone || 'UTC',
                },
            },
            projectStage: {
                _id: 0,
                date: '$_id',
                ...this.GROUP_ACCUMULATORS_PROJECT_STAGE,
            },
            sortStage: { date: 1 },
        });

        return this.observabilityTelemetryModel
            .aggregate<DailyUsageResultContract>(pipeline)
            .exec();
    }

    async getUsageByPr(
        query: TokenUsageQueryContract,
    ): Promise<UsageByPrResultContract[]> {
        const pipeline = this._createUsageAggregationPipeline({
            query,
            groupById: '$attributes.prNumber',
            projectStage: {
                _id: 0,
                prNumber: '$_id',
                ...this.GROUP_ACCUMULATORS_PROJECT_STAGE,
            },
            sortStage: { prNumber: 1 },
            extraMatch: { 'attributes.prNumber': { $exists: true, $ne: null } },
        });

        return this.observabilityTelemetryModel
            .aggregate<UsageByPrResultContract>(pipeline)
            .exec();
    }

    async getDailyUsageByPr(
        query: TokenUsageQueryContract,
    ): Promise<DailyUsageByPrResultContract[]> {
        const pipeline = this._createUsageAggregationPipeline({
            query,
            groupById: {
                prNumber: '$attributes.prNumber',
                date: {
                    $dateToString: {
                        format: '%Y-%m-%d',
                        date: '$timestamp',
                        timezone: query.timezone || 'UTC',
                    },
                },
            },
            projectStage: {
                _id: 0,
                prNumber: '$_id.prNumber',
                date: '$_id.date',
                ...this.GROUP_ACCUMULATORS_PROJECT_STAGE,
            },
            sortStage: { prNumber: 1, date: 1 },
            extraMatch: { 'attributes.prNumber': { $exists: true, $ne: null } },
        });

        return this.observabilityTelemetryModel
            .aggregate<DailyUsageByPrResultContract>(pipeline)
            .exec();
    }
}
