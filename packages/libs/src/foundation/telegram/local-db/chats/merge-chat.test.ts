import type { Chat, ChatEmpty, ChatForbidden } from '../../types/api-types';
import type { ChatPeerRow } from '../types';
import { isChatEmpty, isChatForbidden, mergeChat } from './merge-chat';

function chat(partial: Partial<Chat> & { id: string }): Chat {
  return {
    title: 'Group',
    participantsCount: 2,
    date: 1,
    version: 1,
    ...partial,
  };
}

function row(entity: Chat, overrides: Partial<ChatPeerRow> = {}): ChatPeerRow {
  return {
    id: entity.id,
    entity,
    minAccessHash: false,
    updatedAt: 1,
    ...overrides,
  };
}

describe('isChatEmpty / isChatForbidden', () => {
  it('detects ChatEmpty', () => {
    expect(isChatEmpty({ id: '-10' } as ChatEmpty)).toBe(true);
  });

  it('detects ChatForbidden', () => {
    expect(isChatForbidden({ id: '-10', title: 'Gone' } as ChatForbidden)).toBe(true);
  });

  it('rejects full Chat', () => {
    const c = chat({ id: '-10' });
    expect(isChatEmpty(c)).toBe(false);
    expect(isChatForbidden(c)).toBe(false);
  });
});

describe('mergeChat', () => {
  it('creates stub from empty without local', () => {
    const next = mergeChat({ id: '-10' } as ChatEmpty, undefined, 5);
    expect(next.entity).toEqual({ id: '-10' });
    expect(next.updatedAt).toBe(5);
  });

  it('keeps local on empty when local exists', () => {
    const local = row(chat({ id: '-10', title: 'Keep' }));
    const next = mergeChat({ id: '-10' } as ChatEmpty, local, 9);
    expect(next.entity.title).toBe('Keep');
    expect(next.updatedAt).toBe(9);
  });

  it('creates stub from forbidden without local', () => {
    const next = mergeChat({ id: '-10', title: 'Banned' } as ChatForbidden, undefined, 3);
    expect(next.entity.title).toBe('Banned');
    expect(next.entity.version).toBe(0);
    expect(next.updatedAt).toBe(3);
  });

  it('updates title from forbidden over local', () => {
    const local = row(chat({ id: '-10', title: 'Old', version: 2 }));
    const next = mergeChat({ id: '-10', title: 'Banned' } as ChatForbidden, local, 4);
    expect(next.entity.title).toBe('Banned');
    expect(next.entity.version).toBe(2);
  });

  it('inserts chat when no local', () => {
    const next = mergeChat(chat({ id: '-10', title: 'New' }), undefined, 1);
    expect(next.entity.title).toBe('New');
  });

  it('skips replace when incoming version is older', () => {
    const local = row(chat({ id: '-10', title: 'Current', version: 5 }));
    const next = mergeChat(chat({ id: '-10', title: 'Stale', version: 3 }), local, 8);
    expect(next.entity.title).toBe('Current');
    expect(next.updatedAt).toBe(8);
  });

  it('replaces when incoming version is newer or equal', () => {
    const local = row(chat({ id: '-10', title: 'Old', version: 2 }));
    const next = mergeChat(chat({ id: '-10', title: 'New', version: 3 }), local, 7);
    expect(next.entity.title).toBe('New');
    expect(next.entity.version).toBe(3);
  });
});
