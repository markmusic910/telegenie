import type { TypeEncryptedChat } from '@telegenie/libs/foundation/telegram/types/api-types';

export type EncryptedChatStatus =
  | 'empty'
  | 'waiting'
  | 'requested'
  | 'ready'
  | 'discarded';

export type EncryptedChatEntity = TypeEncryptedChat & {
  status: EncryptedChatStatus;
};

export function encryptedChatStatus(chat: TypeEncryptedChat): EncryptedChatStatus {
  if ('keyFingerprint' in chat) return 'ready';
  if ('gA' in chat) return 'requested';
  if ('accessHash' in chat) return 'waiting';
  if ('historyDeleted' in chat) return 'discarded';
  return 'empty';
}
