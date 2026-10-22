import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { isMemoryCandidate } from './candidate-detector';
import { MemoryExtractor } from './memory-extractor';
import { EntityResolver } from './entity-resolver';
import { MemoryConsolidator } from './memory-consolidator';
import type { EntityRepository } from '../repository/entity.repository';
import type { MemoryRepository } from '../repository/memory.repository';
import type { MemorySourceRepository } from '../repository/memory-source.repository';
import type { CommitmentRepository } from '../repository/commitment.repository';
import type { AgentMessageRecord } from '../../types/agent-message-record';

export type MemoryEngineOptions = {
  model: BaseChatModel;
  entityRepository: EntityRepository;
  memoryRepository: MemoryRepository;
  memorySourceRepository: MemorySourceRepository;
  commitmentRepository: CommitmentRepository;
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
 *     → CandidateDetector (keyword filter)
 *     → MemoryExtractor (LLM structured extraction)
 *     → EntityResolver (name → Entity)
 *     → MemoryConsolidator (dedup + persist)
 *
 * Called only from the leader tab's agent worker via AgentWorkerApi.processNewMessages().
 * Idempotent: MemoryConsolidator checks memory_sources.messageId before writing.
 */
export class MemoryEngine {
  private readonly extractor: MemoryExtractor;
  private readonly resolver: EntityResolver;
  private readonly consolidator: MemoryConsolidator;

  constructor(options: MemoryEngineOptions) {
    this.extractor = new MemoryExtractor(options.model);
    this.resolver = new EntityResolver(options.entityRepository);
    this.consolidator = new MemoryConsolidator(
      options.memoryRepository,
      options.memorySourceRepository,
      options.commitmentRepository,
      this.resolver,
    );
  }

  async processMessages(messages: AgentMessageRecord[]): Promise<ProcessMessagesResult> {
    const result: ProcessMessagesResult = {
      processed: 0,
      skipped: 0,
      memoriesCreated: 0,
      memoriesSuperseded: 0,
    };

    for (const message of messages) {
      // Skip non-text / empty messages
      if (!message.message?.trim()) {
        result.skipped++;
        continue;
      }

      // Candidate detector pre-filter
      if (!isMemoryCandidate(message)) {
        result.skipped++;
        continue;
      }

      result.processed++;

      // LLM extraction
      const candidates = await this.extractor.extract(message);
      if (candidates.length === 0) continue;

      // Consolidate (dedup + persist)
      const consolidateResult = await this.consolidator.consolidate(candidates, message);
      result.memoriesCreated += consolidateResult.created;
      result.memoriesSuperseded += consolidateResult.superseded;
      result.skipped += consolidateResult.skipped;
    }

    return result;
  }
}
