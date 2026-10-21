import type { User } from '../types/users';
import { LocalDb } from './local-db';

function createDb(slot = `slot-${Date.now()}-${Math.random()}`): LocalDb {
  return new LocalDb({
    accountSlot: slot,
    flushDelayMs: 10_000,
  });
}

function sampleUser(overrides: Partial<User> = {}): User {
  return {
    id: '1',
    accessHash: 'hash-full',
    firstName: 'Ada',
    min: false,
    contact: true,
    ...overrides,
  } as User;
}

describe('LocalDb', () => {
  let db: LocalDb;

  afterEach(async () => {
    if (db) {
      try {
        await db.deleteDatabase();
      } catch {
        db.destroy();
      }
    }
  });

  it('isolates account slots', async () => {
    const a = createDb(`a-${Date.now()}`);
    const b = createDb(`b-${Date.now()}`);
    db = a;
    await a.open();
    await b.open();
    await a.putUser(sampleUser({ firstName: 'A' }));
    await expect(b.getUser('1')).resolves.toBeUndefined();
    await b.deleteDatabase();
  });

  it('close / flush / destroy lifecycle', async () => {
    db = createDb();
    await db.open();
    await db.putUser(sampleUser({ firstName: 'Flush' }));
    await db.flush();
    db.close();
    db.destroy();
    db = createDb();
  });

  it('dbName uses telegenie-foundation_ prefix', () => {
    db = createDb('slotX');
    expect(db.dbName).toBe('telegenie-foundation_slotX');
  });

  it('msgIdBoxForPeer uses common for user/chat and peer id for channel', () => {
    expect(LocalDb.msgIdBoxForPeer('1')).toBe('common');
    expect(LocalDb.msgIdBoxForPeer('-10')).toBe('common');
    expect(LocalDb.msgIdBoxForPeer('-1000000000123')).toBe('-1000000000123');
  });

  describe('entity change notifier', () => {
    it('wires constructor onEntityChange through a put', async () => {
      const changes: unknown[] = [];
      db = new LocalDb({
        accountSlot: `notify-${Date.now()}`,
        flushDelayMs: 10_000,
        onEntityChange: (c) => changes.push(c),
      });
      await db.open();
      await db.putUser(sampleUser({ id: '1' }));
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        store: 'users',
        kind: 'put',
        entities: [expect.objectContaining({ id: '1' })],
      });
    });

    it('setEntityChangeNotifier replaces and clears', async () => {
      const a: unknown[] = [];
      const b: unknown[] = [];
      db = createDb();
      await db.open();
      db.setEntityChangeNotifier((c) => a.push(c));
      await db.putUser(sampleUser());
      expect(a).toHaveLength(1);
      db.setEntityChangeNotifier((c) => b.push(c));
      await db.putUser(sampleUser({ firstName: 'Other' }));
      expect(a).toHaveLength(1);
      expect(b).toHaveLength(1);
      db.setEntityChangeNotifier(undefined);
      await db.putUser(sampleUser({ firstName: 'Silent' }));
      expect(b).toHaveLength(1);
    });

    it('logs notifier errors without throwing', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      db = new LocalDb({
        accountSlot: `err-${Date.now()}`,
        flushDelayMs: 10_000,
        onEntityChange: () => {
          throw new Error('boom');
        },
      });
      await db.open();
      await expect(db.putUser(sampleUser())).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledWith('[LocalDb] onEntityChange error', expect.any(Error));
      error.mockRestore();
    });
  });
});
