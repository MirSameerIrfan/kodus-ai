import { Injectable } from '@nestjs/common';
import { IErrorClassifierService } from '@libs/workflow-queue/domain/contracts/error-classifier.service.contract';
import { ErrorClassification } from '@libs/workflow-queue/domain/enums/error-classification.enum';

@Injectable()
export class ErrorClassifierService implements IErrorClassifierService {
    async classify(error: Error): Promise<ErrorClassification> {
        // Erros de rede/timeout são retryable
        if (
            error.message.includes('timeout') ||
            error.message.includes('network') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('ETIMEDOUT')
        ) {
            return ErrorClassification.RETRYABLE;
        }

        // Erros de validação são non-retryable
        if (
            error.message.includes('validation') ||
            error.message.includes('invalid') ||
            error.message.includes('not found') ||
            error.message.includes('unauthorized')
        ) {
            return ErrorClassification.NON_RETRYABLE;
        }

        // Por padrão, assume retryable (pode ser ajustado)
        return ErrorClassification.RETRYABLE;
    }
}
