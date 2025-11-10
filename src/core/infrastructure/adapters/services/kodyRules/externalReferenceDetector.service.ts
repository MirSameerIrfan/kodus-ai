import { Inject, Injectable } from '@nestjs/common';
import { ExternalReferenceLoaderService } from './externalReferenceLoader.service';
import { CodeManagementService } from '@/core/infrastructure/adapters/services/platformIntegration/codeManagement.service';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import {
    CONTEXT_REFERENCE_SERVICE_TOKEN,
    IContextReferenceService,
} from '@/core/domain/contextReferences/contracts/context-reference.service.contract';

/**
 * @deprecated
 * Mantido apenas para compatibilidade com testes antigos que ainda importam
 * ExternalReferenceDetectorService. Toda a lógica real vive em
 * ExternalReferenceLoaderService.
 */
@Injectable()
export class ExternalReferenceDetectorService extends ExternalReferenceLoaderService {
    constructor(
        codeManagementService: CodeManagementService,
        logger: PinoLoggerService,
        @Inject(CONTEXT_REFERENCE_SERVICE_TOKEN)
        contextReferenceService: IContextReferenceService,
    ) {
        super(codeManagementService, logger, contextReferenceService);
    }
}
