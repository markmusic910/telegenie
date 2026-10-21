import type { AgentMessageRecord } from '../../types/agent-message-record';
import type { CommitmentRepository } from '../repository/commitment.repository';
import type { MemorySourceRepository } from '../repository/memory-source.repository';
import type { MemoryRepository } from '../repository/memory.repository';
import type { EntityResolver } from './entity-resolver';
import type { ExtractionCandidate } from './memory-extractor';

export type ConsolidateResult = {
  created: number;
  superseded: number;
  skipped: number;
};

/**
 * Validates, deduplicates, and persists extraction candidates.
 *
 * Responsibilities:
 * 1. Skip messages already sourced (messageId dedup key).
 * 2. Resolve subject/object names to Entity records via EntityResolver.
 * 3. Check for existing ACTIVE memory with same subjectId + predicate.
 *    - If found and content differs → mark old as SUPERSEDED, insert new.
 *    - If found and content matches → skip (no change).
 * 4. Write MemorySource for every new memory.
 * 5. Write Commitment for COMMITMENT-type memories.
 *
 * NOTE: The LLM (MemoryExtractor) proposes candidates — this class decides
 * what gets written. The model never directly mutates IndexedDB.
 */
export class MemoryConsolidator {
  constructor(
    private readonly memoryRepo: MemoryRepository,
    private readonly memorySourceRepo: MemorySourceRepository,
    private readonly commitmentRepo: CommitmentRepository,
    private readonly entityResolver: EntityResolver,
  ) {}

  async consolidate(
    candidates: ExtractionCandidate[],
    message: AgentMessageRecord,
  ): Promise<ConsolidateResult> {
    const messageId = message.id;
    const result: ConsolidateResult = { created: 0, superseded: 0, skipped: 0 };

    // 1. Dedup: skip if this message has already produced memories
    const alreadyProcessed = await this.memorySourceRepo.existsForMessageId(messageId);
    if (alreadyProcessed) {
      result.skipped = candidates.length;
      return result;
    }

    for (const candidate of candidates) {
      try {
        // 2. Resolve subject entity
        const subjectEntity = await this.entityResolver.resolve(candidate.subject, message);
        const subjectId = subjectEntity.id;

        // 3. Resolve object entity if present
        let objectId: string | undefined;
        if (candidate.object) {
          const objectEntity = await this.entityResolver.resolve(candidate.object);
          objectId = objectEntity.id;
        }

        // 4. Check for existing ACTIVE memory with same subjectId + predicate
        if (candidate.predicate) {
          const existing = await this.memoryRepo.findActiveBySubjectAndPredicate(
            subjectId,
            candidate.predicate,
          );
          if (existing) {
            if (existing.content === candidate.content) {
              result.skipped++;
              continue;
            }
            // Supersede old memory
            await this.memoryRepo.markSuperseded(existing.id, message.date * 1000);
            result.superseded++;
          }
        }

        // 5. Create new memory
        const memory = await this.memoryRepo.create({
          type: candidate.type,
          subjectId,
          predicate: candidate.predicate,
          objectId,
          content: candidate.content,
          confidence: candidate.confidence,
          importance: candidate.importance,
          validFrom: message.date * 1000,
        });
        const memoryId = memory.id;
        result.created++;

        // 6. Write MemorySource (traceability)
        await this.memorySourceRepo.insert({
          memoryId,
          messageId,
          sourceStart: candidate.sourceStart,
          sourceEnd: candidate.sourceEnd,
          relevance: candidate.confidence,
        });

        // 7. Write Commitment for COMMITMENT-type memories
        if (candidate.type === 'COMMITMENT') {
          await this.commitmentRepo.create({
            promiserId: subjectId,
            action: candidate.action ?? candidate.predicate ?? 'unknown',
            object: candidate.object,
            dueAt: candidate.dueAt,
            status: 'PENDING',
            confidence: candidate.confidence,
          });
        }
      } catch {
        // Skip malformed candidates rather than aborting the whole batch
        result.skipped++;
      }
    }

    return result;
  }
}
