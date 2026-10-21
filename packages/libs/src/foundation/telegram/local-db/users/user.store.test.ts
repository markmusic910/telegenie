import type { User, UserEmpty, UserFull } from '../../types/users';
import { openStoreHarness } from '../test-harness';
import { UserStore } from './user.store';

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

function sampleUserFull(overrides: Partial<UserFull> = {}): UserFull {
  return {
    id: '1',
    about: 'bio',
    settings: {} as UserFull['settings'],
    notifySettings: {} as UserFull['notifySettings'],
    commonChatsCount: 0,
    ...overrides,
  } as UserFull;
}

describe('UserStore', () => {
  let harness: Awaited<ReturnType<typeof openStoreHarness>>;
  let store: UserStore;

  afterEach(async () => {
    if (harness) await harness.cleanup();
  });

  async function setup(options?: { fullInfoTtlMs?: number }): Promise<void> {
    harness = await openStoreHarness(options);
    store = new UserStore(harness.ctx);
  }

  it('puts non-min user and gets entity with minAccessHash false', async () => {
    await setup();
    await store.putUser(sampleUser());
    await expect(store.getUser('1')).resolves.toMatchObject({
      id: '1',
      firstName: 'Ada',
      accessHash: 'hash-full',
    });
    const row = await store.getUserRow('1');
    expect(row?.minAccessHash).toBe(false);
  });

  it('preserves full hash when min user is put after', async () => {
    await setup();
    await store.putUser(sampleUser());
    await store.putUser(
      sampleUser({
        min: true,
        accessHash: 'min-hash',
        phone: '1',
        firstName: 'Other',
        contact: false,
      }),
    );
    const row = await store.getUserRow('1');
    expect(row?.entity.accessHash).toBe('hash-full');
    expect(row?.minAccessHash).toBe(false);
    expect(row?.entity.contact).toBe(true);
  });

  it('putUser then getUser before flush sees value (RYW)', async () => {
    await setup();
    await store.putUser(sampleUser({ firstName: 'Queued' }));
    await expect(store.getUser('1')).resolves.toMatchObject({ firstName: 'Queued' });
  });

  it('putUsers batch and returns undefined for empty user entity', async () => {
    await setup();
    await store.putUsers([sampleUser({ id: '2', firstName: 'B' }), { id: '3' } as UserEmpty]);
    await expect(store.getUser('2')).resolves.toMatchObject({ firstName: 'B' });
    await expect(store.getUser('3')).resolves.toBeUndefined();
  });

  it('does not notify on empty putUsers', async () => {
    await setup();
    await store.putUsers([]);
    expect(harness.changes).toHaveLength(0);
  });

  it('invalidates userFull when non-min bot flag changes', async () => {
    await setup();
    await store.putUser(sampleUser({ bot: false }));
    await store.putUserFull(sampleUserFull());
    await store.putUser(sampleUser({ bot: true }));
    await expect(store.getUserFull('1')).resolves.toBeUndefined();
  });

  it('expires userFull after TTL', async () => {
    const now = 1_000_000;
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      await setup({ fullInfoTtlMs: 10 });
      await store.putUserFull(sampleUserFull());
      await expect(store.getUserFull('1')).resolves.toMatchObject({ about: 'bio' });
      dateNow.mockReturnValue(now + 11);
      await expect(store.getUserFull('1')).resolves.toBeUndefined();
    } finally {
      dateNow.mockRestore();
    }
  });

  it('notifies on putUser and batched putUsers', async () => {
    await setup();
    await store.putUser(sampleUser({ id: '1' }));
    expect(harness.changes).toHaveLength(1);
    expect(harness.changes[0]).toMatchObject({
      store: 'users',
      kind: 'put',
      entities: [expect.objectContaining({ id: '1' })],
    });

    harness.changes.length = 0;
    await store.putUsers([sampleUser({ id: '2' }), sampleUser({ id: '3' })]);
    expect(harness.changes).toHaveLength(1);
    expect(harness.changes[0]).toMatchObject({
      store: 'users',
      kind: 'put',
      entities: [expect.objectContaining({ id: '2' }), expect.objectContaining({ id: '3' })],
    });
  });

  it('notifies invalidate on userFull', async () => {
    await setup();
    await store.putUserFull(sampleUserFull({ about: 'x' }));
    await store.invalidateUserFull('1');
    expect(harness.changes).toContainEqual({
      store: 'userFull',
      kind: 'invalidate',
      ids: ['1'],
    });
  });
});
