import type { Message } from '../../store/entity/models/message.model';
import type { MessageEntity, MessageStore } from '../../store/types';
import {
  collectMissingReplyTargetIds,
  stampReplyTargetVerified,
} from '../../store/utils/message-reply';
import { updateMessagesByPeer } from './update-messages-by-peer';

/** Read a stored message without EntityStore.get() creating an empty placeholder. */
export function peekStoredMessage(
  ensureMessageStore: (peerId: string) => MessageStore,
  peerId: string,
  messageId: string,
): Message | undefined {
  if (!peerId || !messageId) return undefined;
  return ensureMessageStore(peerId).getAllData().get(messageId);
}

export function stampMessagesForStore(
  entities: MessageEntity[],
  ensureMessageStore: (peerId: string) => MessageStore,
): MessageEntity[] {
  if (!entities.length) return entities;
  return stampReplyTargetVerified(entities, (peerId, messageId) =>
    peekStoredMessage(ensureMessageStore, peerId, messageId),
  );
}

export function missingReplyTargets(
  entities: MessageEntity[],
  ensureMessageStore: (peerId: string) => MessageStore,
): Map<string, string[]> {
  return collectMissingReplyTargetIds(entities, (peerId, messageId) =>
    peekStoredMessage(ensureMessageStore, peerId, messageId),
  );
}

export function writeStampedMessages(
  ensureMessageStore: (peerId: string) => MessageStore,
  entities: MessageEntity[],
): MessageEntity[] {
  const stamped = stampMessagesForStore(entities, ensureMessageStore);
  updateMessagesByPeer(ensureMessageStore, stamped);
  return stamped;
}
