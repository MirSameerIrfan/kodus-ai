import type { KnowledgeItem, LineageRecord } from '../../../packages/context-os-core/src/interfaces.js';

export interface KnowledgeFeedbackCounters {
    helpful: number;
    harmful: number;
    lastHelpfulAt?: number;
    lastHarmfulAt?: number;
}

export interface KnowledgeRecord extends KnowledgeItem {
    feedback?: KnowledgeFeedbackCounters;
}

export interface QueryFilters {
    domain?: string;
    tags?: string[];
    search?: string;
    limit?: number;
}

export interface KnowledgeStore {
    init(): Promise<void>;
    upsert(record: KnowledgeRecord): Promise<void>;
    bulkUpsert(records: KnowledgeRecord[]): Promise<void>;
    findById(id: string): Promise<KnowledgeRecord | undefined>;
    query(filters?: QueryFilters): Promise<KnowledgeRecord[]>;
    appendLineage(id: string, lineage: LineageRecord): Promise<void>;
    updateFeedback(id: string, delta: Partial<KnowledgeFeedbackCounters>): Promise<void>;
    close(): Promise<void>;
}

export type KnowledgeStoreConfig =
    | {
          type: 'filesystem';
          options?: {
              filePath?: string;
          };
      }
    | {
          type: 'weaviate';
          options: {
              url: string;
              apiKey?: string;
              className?: string;
          };
      }
    | {
          type: 'postgres';
          options?: Record<string, unknown>;
      }
    | {
          type: 'chroma';
          options?: Record<string, unknown>;
      };
