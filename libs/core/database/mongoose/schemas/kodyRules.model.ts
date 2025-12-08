import { CoreDocument } from '@libs/common/infrastructure/repositories/model/mongodb';
import { IKodyRule } from '@libs/kody-rules/domain/interfaces/kodyRules.interface';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
    collection: 'kodyRules',
    timestamps: true,
    autoIndex: true,
})
export class KodyRulesModel extends CoreDocument {
    @Prop({ type: String, required: true })
    public organizationId: string;

    @Prop({ type: Array, required: true })
    public rules: IKodyRule[];
}

export const KodyRulesSchema = SchemaFactory.createForClass(KodyRulesModel);
