import type {
  AgentMessageRecord,
  DialogMemoryContext,
} from '../../types/agent-message-record';
import type { IMemoryRepository, IMemorySourceRepository } from '../repository/repository.types';
import type { EmbeddingProvider } from './embedding-provider';
import type { EntityResolver } from './entity-resolver';
import type { ExtractionCandidate } from './memory-extractor';

export type ConsolidateResult = {
  created: number;
  superseded: number;
  skipped: number;
};

/**
 * Validates, deduplicates, and persists extraction candidates into the knowledge graph.
 *
 * Responsibilities:
 * 1. Skip messages already sourced (`messageId` dedup key).
 * 2. Resolve subject/object names to Entity records via EntityResolver & link to Dialog.
 * 3. Check for existing ACTIVE memory with same `subjectId + predicate`.
 *    - If found and content matches → skip (no change).
 *    - If found and content differs → create new, then mark old as SUPERSEDED with `SUPERSEDES` edge.
 * 4. Optionally compute vector embedding via `EmbeddingProvider` when configured.
 * 5. Write `DERIVED_FROM` edge + `:MessageRef` + `:Dialog` provenance.
 */
export class MemoryConsolidator {
  constructor(
    private readonly memoryRepo: IMemoryRepository,
    private readonly memorySourceRepo: IMemorySourceRepository,
    private readonly entityResolver: EntityResolver,
    private readonly embeddingProvider?: EmbeddingProvider,
  ) {}

  async consolidate(
    candidates: ExtractionCandidate[],
    message: AgentMessageRecord,
    dialogContext?: DialogMemoryContext,
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
        // 2. Resolve subject entity & link to dialog
        const subjectEntity = await this.entityResolver.resolve(
          candidate.subject,
          message,
          dialogContext,
        );
        const subjectId = subjectEntity.id;
        await this.entityResolver.linkToDialog(subjectId, message.peerId);

        // 3. Resolve object entity if present
        let objectId: string | undefined;
        if (candidate.object) {
          const objectEntity = await this.entityResolver.resolve(
            candidate.object,
            message,
            dialogContext,
          );
          objectId = objectEntity.id;
        }

        // 4. Check for existing ACTIVE memory with same subjectId + predicate
        let supersededTargetId: string | undefined;
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
            supersededTargetId = existing.id;
          }
        }

        // 5. Optionally compute embedding vector
        const embedding = this.embeddingProvider
          ? await this.embeddingProvider.embedText(candidate.content).catch(() => undefined)
          : undefined;

        // 6. Create new memory
        const memory = await this.memoryRepo.create({
          type: candidate.type,
          subjectId,
          predicate: candidate.predicate,
          objectId,
          content: candidate.content,
          confidence: candidate.confidence,
          importance: candidate.importance,
          validFrom: message.date * 1000,
          embedding,
        });
        result.created++;

        // 7. Wire SUPERSEDES edge & mark old memory superseded
        if (supersededTargetId) {
          await this.memoryRepo.markSuperseded(
            supersededTargetId,
            message.date * 1000,
            memory.id,
          );
          result.superseded++;
        }

        // 8. Write MemorySource + MessageRef + Dialog provenance
        await this.memorySourceRepo.insert(
          {
            memoryId: memory.id,
            messageId,
            sourceStart: candidate.sourceStart,
            sourceEnd: candidate.sourceEnd,
            relevance: candidate.confidence,
          },
          {
            peerId: message.peerId,
            date: message.date,
            fromId: message.fromId,
            authorEntityId: subjectId,
          },
        );
      } catch {
        // Skip malformed candidates rather than aborting the whole batch
        result.skipped++;
      }
    }

    return result;
  }
}
