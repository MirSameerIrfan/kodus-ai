import { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
import {
    DRY_RUN_SERVICE_TOKEN,
    IDryRunService,
} from '@/core/domain/dryRun/contracts/dryRun.service.contract';
import {
    IDryRunEvent,
    DryRunEventType,
    DryRunStatus,
} from '@/core/domain/dryRun/interfaces/dryRun.interface';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, fromEvent, merge } from 'rxjs';
import { map, take, first, filter, takeWhile } from 'rxjs/operators';

@Injectable()
export class SseDryRunUseCase {
    constructor(
        @Inject(DRY_RUN_SERVICE_TOKEN)
        private readonly dryRunService: IDryRunService,

        private readonly logger: PinoLoggerService,

        private readonly eventEmitter: EventEmitter2,
    ) {}

    async execute(params: { correlationId: string }) {
        const { correlationId } = params;

        const observables: Observable<IDryRunEvent>[] = [];

        for (const eventType of Object.values(DryRunEventType)) {
            observables.push(
                fromEvent(
                    this.eventEmitter,
                    `dryRun.${correlationId}.${eventType}`,
                ).pipe(map((event: IDryRunEvent) => event)),
            );
        }

        return merge(...observables).pipe(
            takeWhile((event) => {
                if (event.type === DryRunEventType.REMOVED) {
                    return false;
                }
                if (
                    event.type === DryRunEventType.STATUS_UPDATED &&
                    (event.payload.status === DryRunStatus.COMPLETED ||
                        event.payload.status === DryRunStatus.FAILED)
                ) {
                    return false;
                }
                return true;
            }, true),
        );
    }
}
