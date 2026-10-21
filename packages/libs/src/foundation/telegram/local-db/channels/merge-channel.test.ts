import type { Channel, ChannelForbidden } from '../../types/api-types';
import type { ChannelPeerRow } from '../types';
import { isChannelForbidden, mergeChannel } from './merge-channel';

function channel(partial: Partial<Channel> & { id: string }): Channel {
  return {
    title: 'Chan',
    photo: {} as Channel['photo'],
    date: 1,
    min: false,
    ...partial,
  };
}

function forbidden(partial: Partial<ChannelForbidden> & { id: string }): ChannelForbidden {
  return {
    accessHash: 'fh',
    title: 'Forbidden',
    ...partial,
  };
}

function row(entity: Channel, overrides: Partial<ChannelPeerRow> = {}): ChannelPeerRow {
  return {
    id: entity.id,
    entity,
    minAccessHash: false,
    updatedAt: 1,
    ...overrides,
  };
}

describe('isChannelForbidden', () => {
  it('detects ChannelForbidden', () => {
    expect(isChannelForbidden(forbidden({ id: '-1000000000123' }))).toBe(true);
  });

  it('rejects Channel with photo/min', () => {
    expect(isChannelForbidden(channel({ id: '-1000000000123', accessHash: 'a' }))).toBe(false);
  });
});

describe('mergeChannel', () => {
  it('creates stub from ChannelForbidden without local', () => {
    const { row: next, invalidateFull } = mergeChannel(
      forbidden({ id: '-1000000000123', broadcast: true }),
      undefined,
      10,
    );
    expect(invalidateFull).toBe(false);
    expect(next.entity.title).toBe('Forbidden');
    expect(next.entity.accessHash).toBe('fh');
    expect(next.entity.broadcast).toBe(true);
    expect(next.updatedAt).toBe(10);
  });

  it('merges ChannelForbidden over local applying forbidden hash', () => {
    const local = row(
      channel({ id: '-1000000000123', accessHash: 'full', title: 'Old', megagroup: true }),
    );
    const { row: next } = mergeChannel(
      forbidden({ id: '-1000000000123', title: 'New', accessHash: 'fh2' }),
      local,
      20,
    );
    expect(next.entity.title).toBe('New');
    // ChannelForbidden is treated as a full (non-min) hash, so it replaces local
    expect(next.entity.accessHash).toBe('fh2');
    expect(next.minAccessHash).toBe(false);
    expect(next.entity.megagroup).toBe(true);
  });

  it('inserts non-min channel when no local', () => {
    const { row: next } = mergeChannel(
      channel({ id: '-1000000000123', accessHash: 'ah' }),
      undefined,
      5,
    );
    expect(next.minAccessHash).toBe(false);
    expect(next.entity.accessHash).toBe('ah');
  });

  it('inserts min channel with derived minAccessHash when no local', () => {
    const { row: next } = mergeChannel(
      channel({ id: '-1000000000123', accessHash: 'mh', min: true }),
      undefined,
    );
    expect(next.minAccessHash).toBe(true);
  });

  it('replaces with non-min and invalidates full when forum changes', () => {
    const local = row(channel({ id: '-1000000000123', accessHash: 'a', forum: false }));
    const { row: next, invalidateFull } = mergeChannel(
      channel({ id: '-1000000000123', accessHash: 'b', forum: true }),
      local,
    );
    expect(invalidateFull).toBe(true);
    expect(next.entity.forum).toBe(true);
    expect(next.entity.accessHash).toBe('b');
  });

  it('does not invalidate full when invalidate keys unchanged', () => {
    const local = row(
      channel({ id: '-1000000000123', accessHash: 'a', title: 'A', forum: false }),
    );
    const { invalidateFull } = mergeChannel(
      channel({ id: '-1000000000123', accessHash: 'a', title: 'B', forum: false }),
      local,
    );
    expect(invalidateFull).toBe(false);
  });

  it('applies allowed min fields over non-min local and keeps min false', () => {
    const local = row(
      channel({
        id: '-1000000000123',
        accessHash: 'full',
        title: 'Old',
        scam: false,
        min: false,
      }),
    );
    const { row: next } = mergeChannel(
      channel({
        id: '-1000000000123',
        accessHash: 'minh',
        min: true,
        title: 'New',
        scam: true,
        verified: true,
      }),
      local,
    );
    expect(next.entity.accessHash).toBe('full');
    expect(next.minAccessHash).toBe(false);
    expect(next.entity.min).toBe(false);
    expect(next.entity.title).toBe('New');
    expect(next.entity.scam).toBe(true);
    expect(next.entity.verified).toBe(true);
  });

  it('keeps min true when merging min over min local', () => {
    const local = row(
      channel({ id: '-1000000000123', accessHash: 'm1', min: true, title: 'A' }),
      { minAccessHash: true },
    );
    const { row: next } = mergeChannel(
      channel({ id: '-1000000000123', accessHash: 'm2', min: true, title: 'B' }),
      local,
    );
    expect(next.entity.min).toBe(true);
    expect(next.entity.title).toBe('B');
    expect(next.minAccessHash).toBe(true);
  });

  it('deletes undefined min-apply keys from merged entity', () => {
    const local = row(
      channel({
        id: '-1000000000123',
        accessHash: 'full',
        username: 'old',
        min: false,
      }),
    );
    const incoming = channel({
      id: '-1000000000123',
      accessHash: 'm',
      min: true,
      username: undefined,
    });
    // ensure key is present so merge walks it
    Object.assign(incoming, { username: undefined });
    const { row: next } = mergeChannel(incoming, local);
    expect(next.entity.username).toBeUndefined();
  });
});
