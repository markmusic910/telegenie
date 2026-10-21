import type {
  TypeChatAdminRights,
  TypeChatBannedRights,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import type { MessageEntity } from '../../store/types/message';

/** Telegram `config.editTimeLimit` is usually 48 hours. App config is not stored yet. */
export const EDIT_TIME_LIMIT_SEC = 172_800;

export type MessageActionPeerKind = 'user' | 'chat' | 'channel';

/** Chat facts the context menu needs for copy, forward, pin, delete, and edit. */
export type MessageActionChat = {
  peerKind: MessageActionPeerKind;
  forbidden?: boolean;
  broadcast?: boolean;
  megagroup?: boolean;
  creator?: boolean;
  /** Private chat with a bot. */
  bot?: boolean;
  noforwards?: boolean;
  adminRights?: Pick<TypeChatAdminRights, 'editMessages' | 'pinMessages' | 'deleteMessages'>;
  defaultBannedRights?: Pick<TypeChatBannedRights, 'pinMessages'>;
};

export type MessageActionTarget = Pick<
  MessageEntity,
  | 'id'
  | 'kind'
  | 'peerId'
  | 'out'
  | 'noforwards'
  | 'ttlPeriod'
  | 'pinned'
  | 'message'
  | 'date'
  | 'fwdFrom'
  | 'viaBotId'
  | 'media'
> & {
  /** Stickers have no text body to put on the clipboard. */
  isSticker?: boolean;
};

export type MessageActionInput = {
  message: MessageActionTarget;
  chat?: MessageActionChat;
  currentUserId?: string;
  /** Ids already in the dialog pinned list. */
  pinnedMessageIds?: readonly number[];
  /** Unix seconds for the edit window. Defaults to `Date.now()`. */
  nowSec?: number;
};

export type MessageMenuActions = {
  canEdit: boolean;
  canCopy: boolean;
  canForward: boolean;
  canPin: boolean;
  canUnpin: boolean;
  canDelete: boolean;
  canDeleteForAll: boolean;
  /** Pin dialog offers “notify members” (private non-self, basic group, supergroup). */
  canNotifyPin: boolean;
};

function isNormal(message: MessageActionTarget): boolean {
  return message.kind === 'message';
}

function isPrivate(chat?: MessageActionChat): boolean {
  return chat?.peerKind === 'user';
}

function isBasicGroup(chat?: MessageActionChat): boolean {
  return chat?.peerKind === 'chat';
}

function isSuperGroup(chat?: { megagroup?: boolean }): boolean {
  return Boolean(chat?.megagroup);
}

function isSaved(message: { peerId: string }, currentUserId?: string): boolean {
  return currentUserId != null && message.peerId === currentUserId;
}

function protectedContent(message: MessageActionTarget, chat?: MessageActionChat): boolean {
  return Boolean(message.noforwards || chat?.noforwards);
}

function hasTtl(message: MessageActionTarget): boolean {
  return (message.ttlPeriod ?? 0) > 0;
}

function isListedPinned(message: MessageActionTarget, pinnedMessageIds?: readonly number[]): boolean {
  if (message.pinned) return true;
  if (message.id == null || !pinnedMessageIds?.length) return false;
  const id = Number(message.id);
  return Number.isInteger(id) && pinnedMessageIds.includes(id);
}

/** Whether this user may pin or unpin in the chat. */
function hasPinRight(chat?: MessageActionChat): boolean {
  if (!chat) return false;
  if (chat.peerKind === 'user' || chat.creator) return true;
  if (chat.forbidden) return false;
  if (chat.peerKind === 'channel' && !isSuperGroup(chat)) {
    return Boolean(chat.adminRights?.editMessages);
  }
  if (chat.defaultBannedRights?.pinMessages) return false;
  return Boolean(chat.adminRights?.pinMessages);
}

export function canCopyMessage({ message, chat }: MessageActionInput): boolean {
  if (message.isSticker) return false;
  return isNormal(message) && !protectedContent(message, chat);
}

export function canForwardMessage({ message, chat }: MessageActionInput): boolean {
  return isNormal(message) && !hasTtl(message) && !protectedContent(message, chat);
}

export function canPinMessage(input: MessageActionInput): boolean {
  return (
    isNormal(input.message) &&
    hasPinRight(input.chat) &&
    !isListedPinned(input.message, input.pinnedMessageIds)
  );
}

export function canUnpinMessage(input: MessageActionInput): boolean {
  return (
    isNormal(input.message) &&
    hasPinRight(input.chat) &&
    isListedPinned(input.message, input.pinnedMessageIds)
  );
}

export function canDeleteMessage({ message, chat }: MessageActionInput): boolean {
  if (!isNormal(message)) return false;
  return (
    isPrivate(chat) ||
    message.out === true ||
    isBasicGroup(chat) ||
    Boolean(chat?.creator) ||
    Boolean(chat?.adminRights?.deleteMessages)
  );
}

export function canDeleteForAll(input: MessageActionInput): boolean {
  if (!canDeleteMessage(input)) return false;
  const { message, chat, currentUserId } = input;
  if (chat?.forbidden) return false;
  if (isPrivate(chat) && !isSaved(message, currentUserId) && !chat?.bot) return true;
  if (
    isBasicGroup(chat) &&
    (message.out === true || Boolean(chat?.creator) || Boolean(chat?.adminRights?.deleteMessages))
  ) {
    return true;
  }
  return false;
}

export function canNotifyPin({ message, chat, currentUserId }: MessageActionInput): boolean {
  if (!chat || !isNormal(message) || !hasPinRight(chat)) return false;
  if (chat.peerKind === 'user') return !isSaved(message, currentUserId);
  if (chat.peerKind === 'chat') return true;
  return isSuperGroup(chat);
}

function isTextBody(media: MessageActionTarget['media']): boolean {
  if (media == null) return true;
  return 'webpage' in media && media.webpage != null;
}

/**
 * Whether the context menu should offer Edit for a text message.
 * Mirrors telegram-genie `selectAllowedMessageActionsSlow`, limited to a text body.
 */
export function canEditTextMessage({
  message,
  chat,
  currentUserId,
  nowSec = Math.floor(Date.now() / 1000),
}: MessageActionInput): boolean {
  if (message.kind !== 'message') return false;
  if (!message.message.trim()) return false;
  if (!isTextBody(message.media)) return false;
  if (message.fwdFrom || message.viaBotId) return false;
  if (chat?.forbidden) return false;

  const canEditOthers = Boolean(chat?.creator || chat?.adminRights?.editMessages);
  const isBroadcast = Boolean(chat?.broadcast) && !isSuperGroup(chat);
  const hasEditRight = message.out === true || (isBroadcast && canEditOthers);
  if (!hasEditRight) return false;

  const supergroupUnlimited =
    isSuperGroup(chat) && Boolean(chat?.creator || chat?.adminRights?.pinMessages);
  const channelUnlimited = isBroadcast && canEditOthers;
  if (isSaved(message, currentUserId) || supergroupUnlimited || channelUnlimited) return true;

  return nowSec - message.date < EDIT_TIME_LIMIT_SEC;
}

export function messageMenuActions(input: MessageActionInput): MessageMenuActions {
  return {
    canEdit: canEditTextMessage(input),
    canCopy: canCopyMessage(input),
    canForward: canForwardMessage(input),
    canPin: canPinMessage(input),
    canUnpin: canUnpinMessage(input),
    canDelete: canDeleteMessage(input),
    canDeleteForAll: canDeleteForAll(input),
    canNotifyPin: canNotifyPin(input),
  };
}

/** What the selection toolbar may offer for a set of selected messages. */
export type SelectionMenuActions = Pick<MessageMenuActions, 'canCopy' | 'canDelete' | 'canDeleteForAll'>;

/**
 * Aggregate per-message actions for a selection. Every selected message must
 * allow the action. An empty selection allows nothing.
 */
export function selectionMenuActions(inputs: readonly MessageActionInput[]): SelectionMenuActions {
  if (inputs.length === 0) return { canCopy: false, canDelete: false, canDeleteForAll: false };
  return {
    canCopy: inputs.every((input) => canCopyMessage(input)),
    canDelete: inputs.every((input) => canDeleteMessage(input)),
    canDeleteForAll: inputs.every((input) => canDeleteForAll(input)),
  };
}
