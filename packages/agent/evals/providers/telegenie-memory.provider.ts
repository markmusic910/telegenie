import { createChatModel, setModelConfig } from '../../src/agent/models';
import { MemoryDb } from '../../src/memory/db/memory-db';
import type { Entity, Memory, MemorySource } from '../../src/memory/db/memory-db.types';
import { MemoryEngine, type ProcessMessagesResult } from '../../src/memory/engine/memory-engine';
import { EntityRepository } from '../../src/memory/repository/entity.repository';
import { MemorySourceRepository } from '../../src/memory/repository/memory-source.repository';
import { MemoryRepository } from '../../src/memory/repository/memory.repository';
import type {
  AgentMessageRecord,
  DialogMemoryContext,
} from '../../src/types/agent-message-record';

export interface MemoryEngineEvalVars {
  /** Single message string (when using a single-message prompt template). */
  message?: string;
  /** Default peerId for generated message fixtures. */
  peerId?: string;
  /** Default fromId for generated message fixtures. */
  fromId?: string;
  /**
   * Optional dialog-level metadata and scoped participant lookup map (`peers`)
   * passed into `MemoryEngine.processMessages(messages, { dialogContext })`.
   */
  dialogContext?: DialogMemoryContext;
  /** Pre-seeded entities in the Grafeo knowledge graph before running `MemoryEngine.processMessages`. */
  seedEntities?: Array<Partial<Entity> & Pick<Entity, 'name' | 'type'>>;
  /**
   * Pre-seeded memories in the Grafeo knowledge graph before running `MemoryEngine.processMessages`.
   * Useful for testing deduplication and conflict superseding (`subjectName` or `subjectId` + `predicate`).
   */
  seedMemories?: Array<
    Partial<Memory> &
      Pick<Memory, 'type' | 'content'> & {
        /** Optional entity name to auto-resolve/create `subjectId` when seeding. */
        subjectName?: string;
        /** Optional entity name to auto-resolve/create `objectId` when seeding. */
        objectName?: string;
        /** Optional source messageId to pre-populate `MemorySource` (for messageId idempotency testing). */
        sourceMessageId?: string;
      }
  >;
  /**
   * Batch of Telegram messages to feed into `MemoryEngine.processMessages(messages)`.
   * If omitted, a single message is constructed from `vars.message` or `prompt`.
   */
  messages?: Array<Partial<AgentMessageRecord> & Pick<AgentMessageRecord, 'message'>>;
}

export interface MemoryEngineEvalOutput {
  /** Summary counters returned by `MemoryEngine.processMessages`. */
  stats: ProcessMessagesResult;
  /** Currently ACTIVE memories in the knowledge graph after processing. */
  activeMemories: Memory[];
  /** SUPERSEDED memories in the knowledge graph after processing. */
  supersededMemories: Memory[];
  /** All memories (both ACTIVE and SUPERSEDED) in the knowledge graph. */
  allMemories: Memory[];
  /** All resolved entities in the knowledge graph. */
  entities: Entity[];
  /** Provenance links (`DERIVED_FROM` edges) created for active memories. */
  sources: MemorySource[];
}

interface ProviderOptions {
  id?: string;
  config?: {
    model?: string;
    temperature?: number;
  };
}

/**
 * Custom Promptfoo Provider that runs the full end-to-end TeleGenie `MemoryEngine` workflow:
 *   `AgentMessageRecord[]` + `DialogMemoryContext`
 *     -> `CandidateDetector` (`isMemoryCandidate` across message + reply + media)
 *     -> `MemoryExtractor` (LLM structured extraction with dialog & participant metadata)
 *     -> `EntityResolver` (name / `@username` / `telegramPeerId` -> `:Entity` node)
 *     -> `MemoryConsolidator` (dedup, `SUPERSEDES` conflict resolution, `:Memory` + `:MessageRef` + `:Dialog` persistence)
 *
 * Backed by an isolated in-memory Grafeo WASM Knowledge Graph (`MemoryDb({ inMemory: true })`) per test case.
 */
export default class TeleGenieMemoryProvider {
  private readonly providerId: string;
  private readonly model: string;
  private readonly temperature: number;

  constructor(options: ProviderOptions = {}) {
    this.model = options.config?.model ?? 'gpt-4o';
    this.temperature = options.config?.temperature ?? 0;
    this.providerId = options.id ?? `telegenie-memory:${this.model}`;
  }

  id(): string {
    return this.providerId;
  }

  async callApi(
    prompt: string,
    context?: { vars?: MemoryEngineEvalVars },
  ): Promise<{ output: MemoryEngineEvalOutput; error?: string }> {
    const vars: MemoryEngineEvalVars = context?.vars ?? {};
    const nowSec = Math.floor(Date.now() / 1000);
    const defaultPeerId = vars.dialogContext?.peerId ?? vars.peerId ?? 'peer-eval-1';

    setModelConfig({
      model: this.model,
      temperature: this.temperature,
      apiKeys: {
        openai: process.env.OPENAI_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
        google: process.env.GOOGLE_API_KEY,
      },
    });

    const db = new MemoryDb({
      accountSlot: `eval_memory_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      inMemory: true,
    });

    try {
      await db.open();

      const entityRepo = new EntityRepository(db);
      const memoryRepo = new MemoryRepository(db);
      const memorySourceRepo = new MemorySourceRepository(db);

      // 1. Seed preset entities if provided
      for (const seedEntity of vars.seedEntities ?? []) {
        await entityRepo.upsert({
          type: seedEntity.type,
          name: seedEntity.name,
          normalizedName: seedEntity.normalizedName ?? seedEntity.name.trim().toLowerCase(),
          telegramPeerId: seedEntity.telegramPeerId,
        });
      }

      // 2. Seed preset memories (and optional subject/object entities + message sources)
      for (const seedMem of vars.seedMemories ?? []) {
        let subjectId = seedMem.subjectId;
        if (!subjectId && seedMem.subjectName) {
          const subjectEntity = await entityRepo.upsert({
            type: 'PERSON',
            name: seedMem.subjectName,
          });
          subjectId = subjectEntity.id;
        }

        let objectId = seedMem.objectId;
        if (!objectId && seedMem.objectName) {
          const objectEntity = await entityRepo.upsert({
            type: 'THING',
            name: seedMem.objectName,
          });
          objectId = objectEntity.id;
        }

        const created = await memoryRepo.create({
          type: seedMem.type,
          subjectId,
          predicate: seedMem.predicate,
          objectId,
          content: seedMem.content,
          confidence: seedMem.confidence ?? 0.9,
          importance: seedMem.importance ?? 0.8,
          validFrom: seedMem.validFrom ?? (nowSec - 3600) * 1000,
          validUntil: seedMem.validUntil,
          embedding: seedMem.embedding,
        });

        if (seedMem.status && seedMem.status !== 'ACTIVE') {
          await memoryRepo.save({ ...created, status: seedMem.status });
        }

        if (seedMem.sourceMessageId) {
          await memorySourceRepo.insert(
            {
              memoryId: created.id,
              messageId: seedMem.sourceMessageId,
              relevance: seedMem.confidence ?? 0.9,
            },
            {
              peerId: defaultPeerId,
              date: nowSec - 3600,
              fromId: vars.fromId ?? 'user-1',
              authorEntityId: subjectId,
            },
          );
        }
      }

      // 3. Build input message batch preserving all enriched context fields
      const rawMessages =
        vars.messages && vars.messages.length > 0
          ? vars.messages
          : [{ message: vars.message ?? prompt }];

      const messages: AgentMessageRecord[] = rawMessages.map((msg, idx) => ({
        id: msg.id ?? `${msg.peerId ?? defaultPeerId}:msg-${idx + 1}`,
        peerId: msg.peerId ?? defaultPeerId,
        fromId: msg.fromId ?? vars.fromId ?? 'user-1',
        date: msg.date ?? nowSec + idx * 60,
        message: msg.message,
        out: msg.out ?? false,
        ...(msg.threadId ? { threadId: msg.threadId } : {}),
        ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
        ...(msg.mentions ? { mentions: msg.mentions } : {}),
        ...(msg.fwdFrom ? { fwdFrom: msg.fwdFrom } : {}),
        ...(msg.media ? { media: msg.media } : {}),
      }));

      // 4. Run the E2E MemoryEngine pipeline with DialogMemoryContext
      const engine = new MemoryEngine({
        model: createChatModel({
          model: this.model,
          temperature: this.temperature,
          costSource: 'eval:memory-engine',
        }),
        entityRepository: entityRepo,
        memoryRepository: memoryRepo,
        memorySourceRepository: memorySourceRepo,
      });

      const stats = await engine.processMessages(messages, {
        dialogContext: vars.dialogContext,
      });

      // 5. Collect graph state after consolidation
      const [activeMemories, supersededMemories, allMemories, entities] = await Promise.all([
        memoryRepo.findActive(),
        memoryRepo.findByStatus('SUPERSEDED'),
        memoryRepo.findAll(),
        entityRepo.findAll(),
      ]);

      const sourceLists = await Promise.all(
        allMemories.map((m) => memorySourceRepo.findByMemoryId(m.id)),
      );
      const sources = sourceLists.flat();

      return {
        output: {
          stats,
          activeMemories,
          supersededMemories,
          allMemories,
          entities,
          sources,
        },
      };
    } catch (err) {
      return {
        output: {
          stats: {
            processed: 0,
            skipped: 0,
            memoriesCreated: 0,
            memoriesSuperseded: 0,
          },
          activeMemories: [],
          supersededMemories: [],
          allMemories: [],
          entities: [],
          sources: [],
        },
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      await db.close();
    }
  }
}
