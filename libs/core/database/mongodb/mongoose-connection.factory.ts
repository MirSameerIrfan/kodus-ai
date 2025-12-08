import { mongooseHideObjectId } from '@libs/common/utils/mongo-utils';
import { Connection } from 'mongoose';
import * as mongoosePaginate from 'mongoose-paginate';

export class MongooseConnectionFactory {
    public static createForInstance(connection: Connection): Connection {
        connection.plugin(mongooseHideObjectId);
        connection.plugin(mongoosePaginate);
        return connection;
    }
}
