import { NotificationCenter, notificationCenter } from './notification-center';
import { EVENT_TYPES } from './types';

describe('NotificationCenter', () => {
  let center: NotificationCenter;

  beforeEach(() => {
    center = new NotificationCenter();
  });

  it('exports a shared singleton', () => {
    expect(notificationCenter).toBeInstanceOf(NotificationCenter);
  });

  it('emits and receives events via on/off', () => {
    const listener = jest.fn();
    center.on('ping', listener);
    expect(center.emit('ping', 1, 2)).toBe(true);
    expect(listener).toHaveBeenCalledWith(1, 2);

    center.off('ping', listener);
    expect(center.emit('ping', 3)).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('once fires only once and cleans up', () => {
    const listener = jest.fn();
    center.once('once-event', listener);
    center.emit('once-event', 'a');
    center.emit('once-event', 'b');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('a');
  });

  it('offAll removes listeners', () => {
    const listener = jest.fn();
    center.on('x', listener);
    center.offAll('x');
    expect(center.emit('x')).toBe(false);
  });

  it('off is a no-op for unknown listeners', () => {
    expect(() => center.off('missing', jest.fn())).not.toThrow();
  });

  it('swallows sync listener errors', () => {
    center.on('err', () => {
      throw new Error('boom');
    });
    expect(() => center.emit('err')).not.toThrow();
  });

  it('swallows async listener rejections', async () => {
    center.on('async-err', async () => {
      throw new Error('async boom');
    });
    expect(() => center.emit('async-err')).not.toThrow();
    await Promise.resolve();
  });

  it('supports array event keys when registering', () => {
    const listener = jest.fn();
    // Exercise private _addListener array path via casting through on with multi-register pattern
    (center as any)._addListener(['a', 'b'], listener);
    expect((center as any)._listenerMap.get(listener).eventSet.has('a')).toBe(true);
    expect((center as any)._listenerMap.get(listener).eventSet.has('b')).toBe(true);

    (center as any)._removeListener(['a', 'b'], listener);
    expect((center as any)._listenerMap.has(listener)).toBe(false);
  });

  it('emitUpdateStore / onUpdateStore deliver typed payloads', () => {
    const listener = jest.fn();
    center.onUpdateStore<{ id: string }>(EVENT_TYPES.UPDATE_STORE, listener);

    center.emitUpdateStore(EVENT_TYPES.UPDATE_STORE, { id: '1' });
    expect(listener).toHaveBeenCalledWith({
      type: EVENT_TYPES.UPDATE_STORE,
      body: { entities: { id: '1' } },
    });
  });

  it('onUpdateStore ignores non-update-store payloads', () => {
    const listener = jest.fn();
    center.onUpdateStore(EVENT_TYPES.UPDATE_STORE, listener);
    center.emit(EVENT_TYPES.UPDATE_STORE, {
      type: EVENT_TYPES.DELETE_STORE,
      body: { ids: ['1'] },
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it('emitDeleteStore / onDeleteStore deliver typed payloads', () => {
    const listener = jest.fn();
    center.onDeleteStore(EVENT_TYPES.DELETE_STORE, listener);

    center.emitDeleteStore(EVENT_TYPES.DELETE_STORE, ['a', 'b']);
    expect(listener).toHaveBeenCalledWith({
      type: EVENT_TYPES.DELETE_STORE,
      body: { ids: ['a', 'b'] },
    });
  });

  it('onDeleteStore ignores non-delete-store payloads', () => {
    const listener = jest.fn();
    center.onDeleteStore(EVENT_TYPES.DELETE_STORE, listener);
    center.emit(EVENT_TYPES.DELETE_STORE, {
      type: EVENT_TYPES.UPDATE_STORE,
      body: { entities: {} },
    });
    expect(listener).not.toHaveBeenCalled();
  });
});
