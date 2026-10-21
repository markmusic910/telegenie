import { WriteQueue } from './write-queue';

describe('WriteQueue', () => {
  it('coalesces puts for the same store+key (last write wins)', async () => {
    const queue = new WriteQueue();
    const p1 = queue.enqueue('put', 'users', '1', { id: '1', name: 'a' });
    const p2 = queue.enqueue('put', 'users', '1', { id: '1', name: 'b' });

    expect(queue.size).toBe(1);
    expect(queue.peek('users', '1')).toEqual({
      type: 'put',
      store: 'users',
      key: '1',
      value: { id: '1', name: 'b' },
    });

    const batch = queue.take(10);
    expect(batch).toHaveLength(1);
    expect(batch[0].op.value).toEqual({ id: '1', name: 'b' });
    expect(batch[0].resolvers).toHaveLength(2);

    settleAndExpect(batch[0], p1, p2);
  });

  it('delete coalesces over a prior put', async () => {
    const queue = new WriteQueue();
    const p1 = queue.enqueue('put', 'users', '1', { id: '1' });
    const p2 = queue.enqueue('delete', 'users', '1');

    expect(queue.size).toBe(1);
    expect(queue.peek('users', '1')?.type).toBe('delete');

    const [entry] = queue.take(10);
    settleResolversLocal(entry.resolvers);
    await Promise.all([p1, p2]);
  });

  it('take respects max batch size', () => {
    const queue = new WriteQueue();
    queue.enqueue('put', 'users', '1', { id: '1' });
    queue.enqueue('put', 'users', '2', { id: '2' });
    queue.enqueue('put', 'users', '3', { id: '3' });

    const first = queue.take(2);
    expect(first).toHaveLength(2);
    expect(queue.size).toBe(1);

    const second = queue.take(10);
    expect(second).toHaveLength(1);
  });

  it('settleKey resolves waiters and removes the entry', async () => {
    const queue = new WriteQueue();
    const p = queue.enqueue('put', 'users', '1', { id: '1' });
    queue.settleKey('users', '1');
    await expect(p).resolves.toBeUndefined();
    expect(queue.size).toBe(0);
  });

  it('requeue restores ops without waiters when key is free', () => {
    const queue = new WriteQueue();
    queue.enqueue('put', 'users', '1', { id: '1' });
    const [entry] = queue.take(10);
    queue.requeue([entry]);
    expect(queue.size).toBe(1);
    expect(queue.peek('users', '1')?.value).toEqual({ id: '1' });
  });

  it('settleStore resolves only matching store waiters', async () => {
    const queue = new WriteQueue();
    const a = queue.enqueue('put', 'users', '1', { id: '1' });
    const b = queue.enqueue('put', 'chats', '1', { id: '1' });
    queue.settleStore('users');
    await expect(a).resolves.toBeUndefined();
    expect(queue.size).toBe(1);
    queue.settleStore('chats', new Error('fail'));
    await expect(b).rejects.toThrow('fail');
  });

  it('settleAll rejects remaining waiters', async () => {
    const queue = new WriteQueue();
    const p = queue.enqueue('put', 'users', '1', { id: '1' });
    queue.settleAll(new Error('all'));
    await expect(p).rejects.toThrow('all');
    expect(queue.size).toBe(0);
  });

  it('clear drops pending without settling', () => {
    const queue = new WriteQueue();
    void queue.enqueue('put', 'users', '1', { id: '1' });
    queue.clear();
    expect(queue.size).toBe(0);
  });

  it('serializes Date, array, number, and exotic keys', () => {
    const queue = new WriteQueue();
    const date = new Date('2020-01-01T00:00:00.000Z');
    void queue.enqueue('put', 's', date, 1);
    void queue.enqueue('put', 's', [1, 'a'], 2);
    void queue.enqueue('put', 's', 42, 3);
    void queue.enqueue('put', 's', true, 4);
    const buf = new ArrayBuffer(2);
    void queue.enqueue('put', 's', buf as any, 5);
    expect(queue.size).toBe(5);
    expect(WriteQueue.queueKey('s', date)).toContain('Date:');
    expect(WriteQueue.queueKey('s', [1, 'a'])).toContain('[');
  });
});

function settleResolversLocal(
  resolvers: Array<{ resolve: () => void; reject: (e: unknown) => void }>,
  error?: unknown,
): void {
  for (const { resolve, reject } of resolvers) {
    if (error !== undefined) reject(error);
    else resolve();
  }
}

function settleAndExpect(
  entry: { resolvers: Array<{ resolve: () => void; reject: (e: unknown) => void }> },
  ...promises: Promise<void>[]
): void {
  settleResolversLocal(entry.resolvers);
  return void Promise.all(promises);
}
