import { Api } from '@telegenie/teleproto';

import { LocalDb } from '../../local-db/local-db';
import { resolveInputUsers } from './input-user.helper';

describe('resolveInputUsers', () => {
  it('builds InputUser from LocalDb access hashes', async () => {
    const localDb = new LocalDb({
      accountSlot: `input-user-${Date.now()}`,
      flushDelayMs: 10_000,
    });
    await localDb.open();
    await localDb.putUser({
      id: '42',
      firstName: 'Ada',
      accessHash: '99',
    } as any);

    try {
      const users = await resolveInputUsers(localDb, [{ id: '42' }]);
      expect(users[0]).toBeInstanceOf(Api.InputUser);
      expect(users[0].userId?.toString()).toBe('42');
      expect(users[0].accessHash?.toString()).toBe('99');
    } finally {
      await localDb.deleteDatabase();
    }
  });

  it('throws when access hash is missing', async () => {
    await expect(resolveInputUsers(undefined, [{ id: '42' }])).rejects.toThrow(
      'Missing accessHash for user 42',
    );
  });
});
