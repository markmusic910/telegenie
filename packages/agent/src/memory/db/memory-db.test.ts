import { MemoryDb } from './memory-db';
import { EntityRepository } from '../repository/entity.repository';
import { MemoryRepository } from '../repository/memory.repository';
import { MemorySourceRepository } from '../repository/memory-source.repository';

describe('Grafeo MemoryDb & Repositories', () => {
  let db: MemoryDb;
  let entityRepo: EntityRepository;
  let memoryRepo: MemoryRepository;
  let sourceRepo: MemorySourceRepository;

  beforeEach(async () => {
    db = new MemoryDb({
      accountSlot: `test_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      inMemory: true,
    });
    await db.open();
    entityRepo = new EntityRepository(db);
    memoryRepo = new MemoryRepository(db);
    sourceRepo = new MemorySourceRepository(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it('upserts entities case-insensitively and links telegramPeerId', async () => {
    const alice1 = await entityRepo.upsert({
      type: 'PERSON',
      name: 'Alice',
      telegramPeerId: '1001',
    });
    const alice2 = await entityRepo.upsert({
      type: 'PERSON',
      name: 'alice',
    });

    expect(alice2.id).toBe(alice1.id);
    const byPeer = await entityRepo.findByTelegramPeerId('1001');
    expect(byPeer?.id).toBe(alice1.id);
  });

  it('creates memories with ABOUT, MENTIONS, RELATES_TO, and DERIVED_FROM edges', async () => {
    const alice = await entityRepo.upsert({ type: 'PERSON', name: 'Alice' });
    const alpha = await entityRepo.upsert({ type: 'PROJECT', name: 'Project Alpha' });

    const mem = await memoryRepo.create({
      type: 'DECISION',
      subjectId: alice.id,
      predicate: 'leads',
      objectId: alpha.id,
      content: 'Alice leads Project Alpha architecture.',
      confidence: 0.95,
      importance: 0.9,
      validFrom: 1700000000000,
    });

    const source = await sourceRepo.insert(
      {
        memoryId: mem.id,
        messageId: 'chat_1:42',
        relevance: 0.95,
      },
      {
        peerId: 'chat_1',
        date: 1700000000,
        fromId: '1001',
        authorEntityId: alice.id,
      },
    );

    expect(source.memoryId).toBe(mem.id);
    expect(await sourceRepo.existsForMessageId('chat_1:42')).toBe(true);
    expect(await sourceRepo.existsForMessageId('chat_1:99')).toBe(false);

    const active = await memoryRepo.findActive(alice.id);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(mem.id);

    const neighborhood = await memoryRepo.traverseEntityNeighborhood([alice.id], {
      peerId: 'chat_1',
    });
    expect(neighborhood.memories.some((m) => m.id === mem.id)).toBe(true);
    expect(neighborhood.entities.some((e) => e.id === alpha.id)).toBe(true);
  });

  it('handles temporal supersession and excludes superseded memories from active search', async () => {
    const bob = await entityRepo.upsert({ type: 'PERSON', name: 'Bob' });

    const oldMem = await memoryRepo.create({
      type: 'DECISION',
      subjectId: bob.id,
      predicate: 'database_choice',
      content: 'Bob decided to use MySQL for the backend.',
      confidence: 0.9,
      importance: 0.8,
    });

    const newMem = await memoryRepo.create({
      type: 'DECISION',
      subjectId: bob.id,
      predicate: 'database_choice',
      content: 'Bob decided to use PostgreSQL 16 for the backend.',
      confidence: 0.95,
      importance: 0.9,
    });

    await memoryRepo.markSuperseded(oldMem.id, Date.now(), newMem.id);

    const active = await memoryRepo.findActive(bob.id);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(newMem.id);

    const searchResults = await memoryRepo.searchByText('backend', 10);
    expect(searchResults.some((m) => m.id === newMem.id)).toBe(true);
    expect(searchResults.some((m) => m.id === oldMem.id)).toBe(false);
  });

  it('supports BM25 full-text search and hybrid vector search', async () => {
    const carol = await entityRepo.upsert({ type: 'PERSON', name: 'Carol' });

    const m1 = await memoryRepo.create({
      type: 'PREFERENCE',
      subjectId: carol.id,
      content: 'Carol prefers Linear over Jira for issue tracking.',
      confidence: 0.9,
      importance: 0.8,
      embedding: [0.9, 0.1, 0.0, 0.0],
    });

    await memoryRepo.create({
      type: 'FACT',
      subjectId: carol.id,
      content: 'Carol has a flight to Tokyo on December 3rd.',
      confidence: 0.9,
      importance: 0.7,
      embedding: [0.0, 0.0, 0.95, 0.05],
    });

    const textHits = await memoryRepo.searchByText('Linear issue tracking', 5);
    expect(textHits.length).toBeGreaterThan(0);
    expect(textHits[0].id).toBe(m1.id);

    const hybridHits = await memoryRepo.searchHybrid(
      'issue tracker',
      [0.88, 0.12, 0.0, 0.0],
      5,
    );
    expect(hybridHits.length).toBeGreaterThan(0);
    expect(hybridHits[0].id).toBe(m1.id);
  });

  it('re-opens cleanly after invalidateAndReload()', async () => {
    const ent = await entityRepo.upsert({ type: 'THING', name: 'Grafeo' });
    expect(ent.name).toBe('Grafeo');

    const beforeRev = db.getRevision();
    expect(beforeRev).toBeGreaterThan(0);

    await db.invalidateAndReload();
    // Next call lazily re-opens GrafeoDB
    const all = await entityRepo.findAll();
    expect(Array.isArray(all)).toBe(true);
  });
});
