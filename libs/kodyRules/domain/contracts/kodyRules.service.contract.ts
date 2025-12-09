import { IKodyRulesRepository } from './kodyRules.repository.contract';
import { IKodyRule, KodyRulesStatus } from '../interfaces/kodyRules.interface';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { CreateKodyRuleDto } from '@libs/ee/kodyRules/dtos/create-kody-rule.dto';
import { UserInfo } from '@libs/core/infrastructure/config/types/general/codeReviewSettingsLog.type';
import {
    BucketInfo,
    KodyRuleFilters,
    LibraryKodyRule,
} from '@libs/core/infrastructure/config/types/general/kodyRules.type';
import { KodyRulesEntity } from '../entities/kodyRules.entity';

export const KODY_RULES_SERVICE_TOKEN = 'KODY_RULES_SERVICE_TOKEN';

export interface IKodyRulesService extends IKodyRulesRepository {
    createOrUpdate(
        organizationAndTeamData: OrganizationAndTeamData,
        kodyRule: CreateKodyRuleDto,
        userInfo?: UserInfo,
    ): Promise<Partial<IKodyRule> | IKodyRule | null>;

    getLibraryKodyRules(
        filters?: KodyRuleFilters,
        userId?: string,
    ): Promise<LibraryKodyRule[]>;
    getLibraryKodyRulesWithFeedback(
        filters?: KodyRuleFilters,
        userId?: string,
    ): Promise<LibraryKodyRule[]>;

    getLibraryKodyRulesBuckets(): Promise<BucketInfo[]>;

    findRulesByDirectory(
        organizationId: string,
        repositoryId: string,
        directoryId: string,
    ): Promise<Partial<IKodyRule>[]>;
    updateRulesStatusByFilter(
        organizationId: string,
        repositoryId: string,
        directoryId?: string,
        newStatus?: KodyRulesStatus,
    ): Promise<KodyRulesEntity | null>;

    deleteRuleWithLogging(
        organizationAndTeamData: OrganizationAndTeamData,
        ruleId: string,
        userInfo: UserInfo,
    ): Promise<boolean>;

    updateRuleWithLogging(
        organizationAndTeamData: OrganizationAndTeamData,
        kodyRule: CreateKodyRuleDto,
        userInfo?: UserInfo,
    ): Promise<Partial<IKodyRule> | IKodyRule | null>;

    updateRuleReferences(
        organizationId: string,
        ruleId: string,
        references: {
            contextReferenceId?: string;
            // Todos os outros campos de referência foram movidos para Context OS
        },
    ): Promise<IKodyRule | null>;

    getRulesLimitStatus(
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<{
        total: number;
    }>;
}
