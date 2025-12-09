import { CoreDocument } from '@libs/core/infrastructure/repositories/model/mongodb';
import { IDryRunData } from '@libs/dryRun/domain/interfaces/dryRun.interface';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
    collection: 'dryRun',
    timestamps: true,
    autoIndex: true,
})
export class DryRunModel extends CoreDocument {
    @Prop({ type: String, required: true })
    public organizationId: string;

    @Prop({ type: String, required: true })
    public teamId: string;

    @Prop({ type: Array, required: true })
    public runs: Array<IDryRunData>;
}

export const DryRunSchema = SchemaFactory.createForClass(DryRunModel);
