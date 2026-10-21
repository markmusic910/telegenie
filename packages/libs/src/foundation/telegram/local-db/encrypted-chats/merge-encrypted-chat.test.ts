import type {
  EncryptedChat,
  EncryptedChatDiscarded,
  EncryptedChatEmpty,
  EncryptedChatWaiting,
} from '../../types/api-types';
import type { EncryptedChatPeerRow } from '../types';
import { mergeEncryptedChat } from './merge-encrypted-chat';

function waiting(id = 7): EncryptedChatWaiting {
  return {
    id,
    accessHash: 'h',
    date: 1,
    adminId: '1',
    participantId: '2',
  };
}

function ready(id = 7): EncryptedChat {
  return {
    id,
    accessHash: 'h',
    date: 1,
    adminId: '1',
    participantId: '2',
    gAOrB: new Uint8Array([1]),
    keyFingerprint: 'fp',
  };
}

function discarded(id = 7): EncryptedChatDiscarded {
  return { id, historyDeleted: true };
}

function row(entity: EncryptedChatWaiting | EncryptedChat | EncryptedChatEmpty | EncryptedChatDiscarded): EncryptedChatPeerRow {
  return { id: String(entity.id), entity, updatedAt: 1 };
}

describe('mergeEncryptedChat', () => {
  it('inserts when no local row exists', () => {
    const next = mergeEncryptedChat(waiting(), undefined, 5);
    expect(next.entity).toMatchObject({ id: 7, accessHash: 'h' });
    expect(next.updatedAt).toBe(5);
  });

  it('always applies discarded over local', () => {
    const next = mergeEncryptedChat(discarded(), row(ready()), 9);
    expect(next.entity).toEqual(discarded());
    expect(next.updatedAt).toBe(9);
  });

  it('keeps ready when incoming is a lower rank', () => {
    const local = row(ready());
    const next = mergeEncryptedChat(waiting(), local, 4);
    expect(next.entity).toBe(local.entity);
    expect(next.updatedAt).toBe(4);
  });

  it('keeps higher local rank when incoming is lower and not discarded', () => {
    const local = row(waiting());
    const next = mergeEncryptedChat({ id: 7 } as EncryptedChatEmpty, local, 3);
    expect(next.entity).toBe(local.entity);
  });

  it('replaces when incoming rank is higher', () => {
    const next = mergeEncryptedChat(ready(), row(waiting()), 8);
    expect(next.entity).toMatchObject({ keyFingerprint: 'fp' });
    expect(next.updatedAt).toBe(8);
  });
});
