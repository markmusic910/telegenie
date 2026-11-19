import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { isMemoryCandidate } from './candidate-detector';
import { MemoryExtractor } from './memory-extractor';
import { EntityResolver } from './entity-resolver';
import { MemoryConsolidator } from './memory-consolidator';
import type {
  IEntityRepository,
  IMemoryRepository,
  IMemorySourceRepository,
} from '../repository/repository.types';
import type { EmbeddingProvider } from './embedding-provider';
import type {
  AgentMessageRecord,
  DialogMemoryContext,
} from '../../types/agent-message-record';

export type MemoryEngineOptions = {
  model?: BaseChatModel;
  createModel?: (costSource?: string) => BaseChatModel;
  entityRepository: IEntityRepository;
  memoryRepository: IMemoryRepository;
  memorySourceRepository: IMemorySourceRepository;
  embeddingProvider?: EmbeddingProvider;
};

export type ProcessMessagesOptions = {
  costSource?: string;
  dialogContext?: DialogMemoryContext;
};

export type ProcessMessagesResult = {
  processed: number;
  skipped: number;
  memoriesCreated: number;
  memoriesSuperseded: number;
};

/**
 * Memory Engine orchestrator.
 *
 * Pipeline per message:
 *   AgentMessageRecord[]
 *     → CandidateDetector (keyword filter across message + reply + media context)
 *     → MemoryExtractor (LLM structured extraction with DialogMemoryContext)
 *     → EntityResolver (name / handle / peerId → Entity)
 *     → MemoryConsolidator (dedup + persist)
 *
 * Called only from the leader tab's agent worker via AgentWorkerApi.processNewMessages().
 * Idempotent: MemoryConsolidator checks memory_sources.messageId before writing.
 */
export class MemoryEngine {
  private readonly defaultExtractor: MemoryExtractor;
  private readonly createModel?: (costSource?: string) => BaseChatModel;
  private readonly resolver: EntityResolver;
  private readonly consolidator: MemoryConsolidator;

  constructor(options: MemoryEngineOptions) {
    const model = options.model ?? options.createModel?.('memory extraction');
    if (!model) {
      throw new Error('MemoryEngine requires either model or createModel');
    }
    this.defaultExtractor = new MemoryExtractor(model);
    this.createModel = options.createModel;
    this.resolver = new EntityResolver(options.entityRepository);
    this.consolidator = new MemoryConsolidator(
      options.memoryRepository,
      options.memorySourceRepository,
      this.resolver,
      options.embeddingProvider,
    );
  }

  async processMessages(
    messages: AgentMessageRecord[],
    options?: ProcessMessagesOptions,
  ): Promise<ProcessMessagesResult> {
    const extractor =
      options?.costSource && this.createModel
        ? new MemoryExtractor(this.createModel(options.costSource))
        : this.defaultExtractor;
    const dialogContext = options?.dialogContext;

    const result: ProcessMessagesResult = {
      processed: 0,
      skipped: 0,
      memoriesCreated: 0,
      memoriesSuperseded: 0,
    };

    for (const message of messages) {
      // Skip non-text / empty messages unless media carries a text summary
      if (!message.message?.trim() && !message.media?.summary?.trim()) {
        result.skipped++;
        continue;
      }

      // Candidate detector pre-filter (evaluates message + reply quote + media summary)
      if (!isMemoryCandidate(message)) {
        result.skipped++;
        continue;
      }

      result.processed++;

      // LLM extraction
      const candidates = await extractor.extract(message, dialogContext);
      if (candidates.length === 0) continue;

      // Consolidate (dedup + persist)
      const consolidateResult = await this.consolidator.consolidate(
        candidates,
        message,
        dialogContext,
      );
      result.memoriesCreated += consolidateResult.created;
      result.memoriesSuperseded += consolidateResult.superseded;
      result.skipped += consolidateResult.skipped;
    }

    return result;
  }
}
