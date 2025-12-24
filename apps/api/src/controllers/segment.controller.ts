import { Body, Controller, Post } from '@nestjs/common';

import { TrackUseCase } from '@libs/analytics/application/use-cases/segment/track.use-case';

@Controller('segment')
export class SegmentController {
    constructor(private readonly trackUseCase: TrackUseCase) {}

    @Post('/track')
    public async track(@Body() body: any) {
        return this.trackUseCase.execute(body);
    }
}
