import { ErrorClassification } from '../enums/error-classification.enum';

export const ERROR_CLASSIFIER_SERVICE_TOKEN = Symbol('ErrorClassifierService');

export interface IErrorClassifierService {
    classify(error: Error): Promise<ErrorClassification>;
}
