import { Api } from '@telegenie/teleproto';

import { markedChannelIdFromMtp, markedPeerIdFromApiPeer } from '../helpers/peer-id.helper';
import {
  convertDraftMessage,
  convertTypePeer,
  convertTypePeerNotifySettings,
} from '../services/converters/common.converter';
import {
  convertTypeDialogFilter,
  type FolderFilter,
} from '../services/converters/dialog-filter.converter';
import { convertMessageReactions, convertMessages } from '../services/converters/message.converter';
import type {
  MessageEmpty,
  TypeDraftMessage,
  TypeMessageReactions,
  TypePeer,
  TypePeerNotifySettings,
} from '../types/api-types';
import type { Message, MessageService } from '../types/message';

export type StoreSyncMessageOp = 'new' | 'edit';

export type MessageStatsPatch = {
  id: number;
  views?: number;
  forwards?: number;
  pinned?: boolean;
  reactions?: TypeMessageReactions;
};

export type StoreSyncPayload =
  | {
      type: 'message.put';
      op: StoreSyncMessageOp;
      messages: Message[];
      messageServices: MessageService[];
      emptyMessages: MessageEmpty[];
    }
  | {
      type: 'message.patch';
      peerId: string;
      patches: MessageStatsPatch[];
    }
  | {
      type: 'message.delete';
      /** Absent for common `UpdateDeleteMessages`. */
      peerId?: string;
      ids: number[];
    }
  | {
      type: 'read.inbox';
      peerId: string;
      maxId: number;
      stillUnreadCount: number;
    }
  | {
      type: 'read.outbox';
      peerId: string;
      maxId: number;
    }
  | {
      /** `readMessageContents`. `peerId` is set for channels; common-box updates only carry ids. */
      type: 'read.contents';
      peerId?: string;
      ids: number[];
    }
  | {
      type: 'draft';
      peerId: string;
      draft: TypeDraftMessage | undefined;
    }
  | {
      type: 'unreadMark';
      peerId: string;
      unread: boolean;
    }
  | {
      type: 'dialogPinned';
      peerId: string;
      pinned: boolean;
      folderId?: number;
    }
  | {
      type: 'pinnedDialogs';
      folderId?: number;
      peerIds: string[];
    }
  | {
      type: 'notifySettings';
      peerId: string;
      notifySettings: TypePeerNotifySettings;
    }
  | {
      type: 'folderPeer';
      peerId: string;
      folderId: number;
    }
  | {
      type: 'dialogFilter.put';
      id: number;
      filter: FolderFilter;
    }
  | {
      type: 'dialogFilter.delete';
      id: number;
    }
  | {
      type: 'dialogFilter.order';
      order: number[];
    }
  | {
      /** Folders changed wholesale; the tab should refetch `dialogFilter.getAll`. */
      type: 'dialogFilter.reload';
    };

export type DialogOrderPayload = {
  /** Main list only (`folderId` 0). */
  ids: string[];
  /** Main list + archive (`folderId` 0 and 1), ranked together. */
  allIds: string[];
};

/** Bot API / TDLib dialog id from a converted foundation peer. */
export function peerIdFromTypePeer(peer?: TypePeer | null): string {
  if (!peer) return '';
  if ('userId' in peer && peer.userId) return String(peer.userId);
  if ('chatId' in peer && peer.chatId) return String(peer.chatId);
  if ('channelId' in peer && peer.channelId) return String(peer.channelId);
  return '';
}

function messagePut(
  op: StoreSyncMessageOp,
  message: Api.TypeMessage | undefined,
): StoreSyncPayload | undefined {
  if (!message) return undefined;
  const converted = convertMessages([message]);
  if (
    converted.messages.length === 0 &&
    converted.messageServices.length === 0 &&
    converted.emptyMessages.length === 0
  ) {
    return undefined;
  }
  return {
    type: 'message.put',
    op,
    messages: converted.messages,
    messageServices: converted.messageServices,
    emptyMessages: converted.emptyMessages,
  };
}

function peerIdFromApiPeer(peer: Api.TypePeer | undefined): string | undefined {
  if (!peer) return undefined;
  try {
    return markedPeerIdFromApiPeer(peer);
  } catch {
    return undefined;
  }
}

function peerIdFromDialogPeer(peer: Api.TypeDialogPeer | undefined): string | undefined {
  if (!peer || peer instanceof Api.DialogPeerFolder) return undefined;
  if (peer instanceof Api.DialogPeer) {
    return peerIdFromApiPeer(peer.peer);
  }
  return undefined;
}

function channelPeerId(channelId: { toString(): string } | undefined): string | undefined {
  if (channelId == null) return undefined;
  return markedChannelIdFromMtp(channelId);
}

/**
 * Convert a GramJS Update into cloneable store-sync payload(s).
 * Ignored constructors (typing, polls, stories, …) yield an empty array.
 */
export function toStoreSyncPayloads(update: object): StoreSyncPayload[] {
  if (update instanceof Api.UpdateNewMessage) {
    const payload = messagePut('new', update.message);
    return payload ? [payload] : [];
  }
  if (update instanceof Api.UpdateNewChannelMessage) {
    const payload = messagePut('new', update.message);
    return payload ? [payload] : [];
  }
  if (update instanceof Api.UpdateEditMessage) {
    const payload = messagePut('edit', update.message);
    return payload ? [payload] : [];
  }
  if (update instanceof Api.UpdateEditChannelMessage) {
    const payload = messagePut('edit', update.message);
    return payload ? [payload] : [];
  }
  if (update instanceof Api.UpdateDeleteMessages) {
    return [{ type: 'message.delete', ids: update.messages ?? [] }];
  }
  if (update instanceof Api.UpdateDeleteChannelMessages) {
    const peerId = channelPeerId(update.channelId);
    return [{ type: 'message.delete', peerId, ids: update.messages ?? [] }];
  }
  if (update instanceof Api.UpdateChannelMessageViews) {
    const peerId = channelPeerId(update.channelId);
    if (!peerId) return [];
    return [
      {
        type: 'message.patch',
        peerId,
        patches: [{ id: update.id, views: update.views }],
      },
    ];
  }
  if (update instanceof Api.UpdateChannelMessageForwards) {
    const peerId = channelPeerId(update.channelId);
    if (!peerId) return [];
    return [
      {
        type: 'message.patch',
        peerId,
        patches: [{ id: update.id, forwards: update.forwards }],
      },
    ];
  }
  if (update instanceof Api.UpdatePinnedMessages) {
    const peerId = peerIdFromApiPeer(update.peer);
    if (!peerId) return [];
    const pinned = Boolean(update.pinned);
    const ids = update.messages ?? [];
    return [
      {
        type: 'message.patch',
        peerId,
        patches: ids.map((id) => ({ id, pinned })),
      },
    ];
  }
  if (update instanceof Api.UpdateMessageReactions) {
    const peerId = peerIdFromApiPeer(update.peer);
    if (!peerId || !update.reactions) return [];
    return [
      {
        type: 'message.patch',
        peerId,
        patches: [
          {
            id: update.msgId,
            reactions: convertMessageReactions(update.reactions),
          },
        ],
      },
    ];
  }
  if (update instanceof Api.UpdatePinnedChannelMessages) {
    const peerId = channelPeerId(update.channelId);
    if (!peerId) return [];
    const pinned = Boolean(update.pinned);
    const ids = update.messages ?? [];
    return [
      {
        type: 'message.patch',
        peerId,
        patches: ids.map((id) => ({ id, pinned })),
      },
    ];
  }
  if (update instanceof Api.UpdateReadHistoryInbox) {
    const peerId = peerIdFromApiPeer(update.peer);
    if (!peerId) return [];
    return [
      {
        type: 'read.inbox',
        peerId,
        maxId: update.maxId ?? 0,
        stillUnreadCount: update.stillUnreadCount ?? 0,
      },
    ];
  }
  if (update instanceof Api.UpdateReadChannelInbox) {
    const peerId = channelPeerId(update.channelId);
    if (!peerId) return [];
    return [
      {
        type: 'read.inbox',
        peerId,
        maxId: update.maxId ?? 0,
        stillUnreadCount: update.stillUnreadCount ?? 0,
      },
    ];
  }
  if (update instanceof Api.UpdateReadHistoryOutbox) {
    const peerId = peerIdFromApiPeer(update.peer);
    if (!peerId) return [];
    return [{ type: 'read.outbox', peerId, maxId: update.maxId ?? 0 }];
  }
  if (update instanceof Api.UpdateReadChannelOutbox) {
    const peerId = channelPeerId(update.channelId);
    if (!peerId) return [];
    return [{ type: 'read.outbox', peerId, maxId: update.maxId ?? 0 }];
  }
  if (update instanceof Api.UpdateReadMessagesContents) {
    return [{ type: 'read.contents', ids: update.messages ?? [] }];
  }
  if (update instanceof Api.UpdateChannelReadMessagesContents) {
    const peerId = channelPeerId(update.channelId);
    if (!peerId) return [];
    return [{ type: 'read.contents', peerId, ids: update.messages ?? [] }];
  }
  if (update instanceof Api.UpdateDraftMessage) {
    const peerId = peerIdFromApiPeer(update.peer);
    if (!peerId) return [];
    return [{ type: 'draft', peerId, draft: convertDraftMessage(update.draft) }];
  }
  if (update instanceof Api.UpdateDialogUnreadMark) {
    const peerId = peerIdFromDialogPeer(update.peer);
    if (!peerId) return [];
    return [{ type: 'unreadMark', peerId, unread: Boolean(update.unread) }];
  }
  if (update instanceof Api.UpdateDialogPinned) {
    const peerId = peerIdFromDialogPeer(update.peer);
    if (!peerId) return [];
    return [
      {
        type: 'dialogPinned',
        peerId,
        pinned: Boolean(update.pinned),
        folderId: update.folderId,
      },
    ];
  }
  if (update instanceof Api.UpdatePinnedDialogs) {
    const peerIds: string[] = [];
    for (const item of update.order ?? []) {
      const id = peerIdFromDialogPeer(item);
      if (id) peerIds.push(id);
    }
    return [{ type: 'pinnedDialogs', folderId: update.folderId, peerIds }];
  }
  if (update instanceof Api.UpdateNotifySettings) {
    if (!(update.peer instanceof Api.NotifyPeer)) return [];
    const peerId = peerIdFromApiPeer(update.peer.peer);
    if (!peerId) return [];
    return [
      {
        type: 'notifySettings',
        peerId,
        notifySettings: convertTypePeerNotifySettings(update.notifySettings),
      },
    ];
  }
  if (update instanceof Api.UpdateFolderPeers) {
    const payloads: StoreSyncPayload[] = [];
    for (const folderPeer of update.folderPeers ?? []) {
      let peerId = '';
      try {
        peerId = peerIdFromTypePeer(convertTypePeer(folderPeer.peer));
      } catch {
        peerId = '';
      }
      if (!peerId) continue;
      payloads.push({
        type: 'folderPeer',
        peerId,
        folderId: folderPeer.folderId ?? 0,
      });
    }
    return payloads;
  }
  if (update instanceof Api.UpdateDialogFilter) {
    // A missing `filter` means the folder was deleted.
    if (!update.filter) {
      return [{ type: 'dialogFilter.delete', id: update.id }];
    }
    const filter = convertTypeDialogFilter(update.filter);
    if (!filter) return [];
    return [{ type: 'dialogFilter.put', id: update.id, filter }];
  }
  if (update instanceof Api.UpdateDialogFilterOrder) {
    return [{ type: 'dialogFilter.order', order: update.order ?? [] }];
  }
  if (update instanceof Api.UpdateDialogFilters) {
    return [{ type: 'dialogFilter.reload' }];
  }
  return [];
}
