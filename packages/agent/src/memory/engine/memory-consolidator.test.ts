import { MemoryDb } from '../db/memory-db';
import { EntityRepository } from '../repository/entity.repository';
import { MemoryRepository } from '../repository/memory.repository';
import { MemorySourceRepository } from '../repository/memory-source.repository';
import { EntityResolver } from './entity-resolver';
import { MemoryConsolidator } from './memory-consolidator';
import type { EmbeddingProvider } from './embedding-provider';
import { Retriever } from '../../runtime/retriever';
import type { AgentMessageRecord } from '../../types/agent-message-record';

describe('MemoryConsolidator & Graph Retriever (Grafeo)', () => {
  let db: MemoryDb;
  let entityRepo: EntityRepository;
  let memoryRepo: MemoryRepository;
  let sourceRepo: MemorySourceRepository;
  let consolidator: MemoryConsolidator;
  let retriever: Retriever;

  const mockEmbeddingProvider: EmbeddingProvider = {
    model: 'mock-embed',
    dimensions: 4,
    async embedText(text: string): Promise<number[]> {
      if (text.toLowerCase().includes('postgres')) return [0.9, 0.1, 0.0, 0.0];
      if (text.toLowerCase().includes('tokyo')) return [0.0, 0.0, 0.9, 0.1];
      return [0.1, 0.8, 0.1, 0.0];
    },
  };

  beforeEach(async () => {
    db = new MemoryDb({
      accountSlot: `test_consolidator_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      inMemory: true,
    });
    await db.open();
    entityRepo = new EntityRepository(db);
    memoryRepo = new MemoryRepository(db);
    sourceRepo = new MemorySourceRepository(db);
    const resolver = new EntityResolver(entityRepo);
    consolidator = new MemoryConsolidator(
      memoryRepo,
      sourceRepo,
      resolver,
      mockEmbeddingProvider,
    );
    retriever = new Retriever({
      accountSlot: 'test',
      memoryRepository: memoryRepo,
      entityRepository: entityRepo,
      embeddingProvider: mockEmbeddingProvider,
    });
  });

  afterEach(async () => {
    await db.close();
  });

  it('consolidates candidates, deduplicates by messageId, supersedes conflicts, and retrieves via graph', async () => {
    const msg1: AgentMessageRecord = {
      id: 'group_alpha:101',
      peerId: 'group_alpha',
      fromId: 'user_alice',
      date: 1700000100,
      message: 'We decided to use MySQL for Project Alpha.',
    };

    const res1 = await consolidator.consolidate(
      [
        {
          type: 'DECISION',
          subject: 'Alice',
          predicate: 'chose_database',
          object: 'Project Alpha',
          confidence: 0.9,
          importance: 0.9,
          content: 'Alice chose MySQL for Project Alpha.',
        },
      ],
      msg1,
    );

    expect(res1).toEqual({ created: 1, superseded: 0, skipped: 0 });

    // Duplicate messageId should be skipped
    const dupRes = await consolidator.consolidate(
      [
        {
          type: 'DECISION',
          subject: 'Alice',
          predicate: 'chose_database',
          object: 'Project Alpha',
          confidence: 0.9,
          importance: 0.9,
          content: 'Alice chose MySQL for Project Alpha.',
        },
      ],
      msg1,
    );
    expect(dupRes).toEqual({ created: 0, superseded: 0, skipped: 1 });

    // New message supersedes the old decision
    const msg2: AgentMessageRecord = {
      id: 'group_alpha:102',
      peerId: 'group_alpha',
      fromId: 'user_alice',
      date: 1700000200,
      message: 'Actually, we switched Project Alpha to PostgreSQL 16.',
    };

    const res2 = await consolidator.consolidate(
      [
        {
          type: 'DECISION',
          subject: 'Alice',
          predicate: 'chose_database',
          object: 'Project Alpha',
          confidence: 0.95,
          importance: 0.95,
          content: 'Alice switched Project Alpha to PostgreSQL 16.',
        },
      ],
      msg2,
    );
    expect(res2).toEqual({ created: 1, superseded: 1, skipped: 0 });

    // Graph retrieval should return the new active decision and connected entities
    const retrieved = await retriever.searchKnowledgeGraph('PostgreSQL Project Alpha', 'group_alpha');
    expect(retrieved.memories.some((m) => m.content.includes('PostgreSQL 16'))).toBe(true);
    expect(retrieved.memories.some((m) => m.content.includes('MySQL'))).toBe(false);
    expect(retrieved.entities.some((e) => e.name === 'Project Alpha')).toBe(true);
  });
});
