import { PromptExternalReferenceEntity } from '../entities/promptExternalReference.entity';
import {
    IPromptExternalReference,
    PromptSourceType,
    PromptProcessingStatus,
} from '../interfaces/promptExternalReference.interface';

export const PROMPT_EXTERNAL_REFERENCE_REPOSITORY_TOKEN =
    'PROMPT_EXTERNAL_REFERENCE_REPOSITORY_TOKEN';

export interface IPromptExternalReferenceRepository {
    create(
        data: Partial<IPromptExternalReference>,
    ): Promise<PromptExternalReferenceEntity>;

    findByConfigKey(
        configKey: string,
        sourceType: PromptSourceType,
    ): Promise<PromptExternalReferenceEntity | null>;

    findByConfigKeys(
        configKeys: string[],
    ): Promise<PromptExternalReferenceEntity[]>;

    upsert(
        data: Partial<IPromptExternalReference>,
    ): Promise<PromptExternalReferenceEntity>;

    update(
        uuid: string,
        data: Partial<IPromptExternalReference>,
    ): Promise<PromptExternalReferenceEntity | null>;

    delete(uuid: string): Promise<boolean>;

    findByOrganizationId(
        organizationId: string,
    ): Promise<PromptExternalReferenceEntity[]>;

    updateStatus(
        configKey: string,
        sourceType: PromptSourceType,
        status: PromptProcessingStatus,
    ): Promise<PromptExternalReferenceEntity | null>;
}

