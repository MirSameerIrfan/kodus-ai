import { track } from '@libs/common/utils/segment';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TrackUseCase {
    constructor() {}

    async execute(data: {
        userId: string;
        event: string;
        properties?: any;
    }): Promise<void> {
        const { userId, event, properties } = data;

        track(userId, event, properties);
    }
}
