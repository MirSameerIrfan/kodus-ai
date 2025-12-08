import { CoreDocument } from '@shared/infrastructure/repositories/model/mongodb';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
    collection: 'observability_telemetry',
    timestamps: true,
})
export class ObservabilityTelemetryModel extends CoreDocument {
    @Prop({ type: String, required: true })
    name: string;

    @Prop({ type: String, required: true })
    correlationId: string;

    @Prop({ type: Number, required: true })
    duration: number;

    @Prop({ type: Object, required: true })
    attributes: Record<string, any>;
}

export const ObservabilityTelemetryModelSchema = SchemaFactory.createForClass(
    ObservabilityTelemetryModel,
);
