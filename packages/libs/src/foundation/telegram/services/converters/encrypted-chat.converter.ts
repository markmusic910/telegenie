import { Api } from '@telegenie/teleproto';
import type {
  EncryptedChat,
  EncryptedChatDiscarded,
  EncryptedChatEmpty,
  EncryptedChatRequested,
  EncryptedChatWaiting,
  TypeEncryptedChat,
} from '../../types/api-types';

export type EncryptedChatStatus =
  | 'empty'
  | 'waiting'
  | 'requested'
  | 'ready'
  | 'discarded';

export type EncryptedChatWithStatus = TypeEncryptedChat & { status: EncryptedChatStatus };

function statusFromChat(chat: Api.TypeEncryptedChat): EncryptedChatStatus {
  if (chat instanceof Api.EncryptedChatEmpty) return 'empty';
  if (chat instanceof Api.EncryptedChatWaiting) return 'waiting';
  if (chat instanceof Api.EncryptedChatRequested) return 'requested';
  if (chat instanceof Api.EncryptedChat) return 'ready';
  if (chat instanceof Api.EncryptedChatDiscarded) return 'discarded';
  return 'empty';
}

export const convertEncryptedChatEmpty = (chat: Api.EncryptedChatEmpty): EncryptedChatEmpty => ({
  id: chat.id,
});

export const convertEncryptedChatWaiting = (
  chat: Api.EncryptedChatWaiting,
): EncryptedChatWaiting => ({
  id: chat.id,
  accessHash: chat.accessHash.toString(),
  date: chat.date,
  adminId: chat.adminId.toString(),
  participantId: chat.participantId.toString(),
});

export const convertEncryptedChatRequested = (
  chat: Api.EncryptedChatRequested,
): EncryptedChatRequested => ({
  id: chat.id,
  accessHash: chat.accessHash.toString(),
  date: chat.date,
  adminId: chat.adminId.toString(),
  participantId: chat.participantId.toString(),
  gA: chat.gA,
  folderId: chat.folderId,
});

export const convertEncryptedChat = (chat: Api.EncryptedChat): EncryptedChat => ({
  id: chat.id,
  accessHash: chat.accessHash.toString(),
  date: chat.date,
  adminId: chat.adminId.toString(),
  participantId: chat.participantId.toString(),
  gAOrB: chat.gAOrB,
  keyFingerprint: chat.keyFingerprint.toString(),
});

export const convertEncryptedChatDiscarded = (
  chat: Api.EncryptedChatDiscarded,
): EncryptedChatDiscarded => ({
  id: chat.id,
  historyDeleted: chat.historyDeleted,
});

export const convertTypeEncryptedChat = (chat: Api.TypeEncryptedChat): TypeEncryptedChat => {
  if (chat instanceof Api.EncryptedChatEmpty) return convertEncryptedChatEmpty(chat);
  if (chat instanceof Api.EncryptedChatWaiting) return convertEncryptedChatWaiting(chat);
  if (chat instanceof Api.EncryptedChatRequested) return convertEncryptedChatRequested(chat);
  if (chat instanceof Api.EncryptedChat) return convertEncryptedChat(chat);
  if (chat instanceof Api.EncryptedChatDiscarded) return convertEncryptedChatDiscarded(chat);
  throw new Error(`Unknown EncryptedChat type: ${(chat as { className?: string }).className}`);
};

export const convertTypeEncryptedChatWithStatus = (
  chat: Api.TypeEncryptedChat,
): EncryptedChatWithStatus => ({
  ...convertTypeEncryptedChat(chat),
  status: statusFromChat(chat),
});

export const encryptedChatStatus = (chat: TypeEncryptedChat): EncryptedChatStatus => {
  if ('keyFingerprint' in chat) return 'ready';
  if ('gA' in chat) return 'requested';
  if ('accessHash' in chat) return 'waiting';
  if ('historyDeleted' in chat) return 'discarded';
  return 'empty';
};
