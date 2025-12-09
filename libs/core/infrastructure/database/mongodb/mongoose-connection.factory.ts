import { Connection } from 'mongoose';
import * as mongoosePaginate from 'mongoose-paginate';

import { mongooseHideObjectId } from '@libs/core/utils/mongo-utils';

export class MongooseConnectionFactory {
    public static createForInstance(connection: Connection): Connection {
        connection.plugin(mongooseHideObjectId);
        connection.plugin(mongoosePaginate);
        return connection;
    }
}
