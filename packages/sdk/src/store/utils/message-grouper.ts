import type { Message } from '../entity/models/message.model';
import { fallbackPeerDisplay } from './peer-display';

export interface SenderGroup {
  senderId: string;
  isOwn: boolean;
  isAction: boolean;
  messages: Message[];
}

export interface MessageDateGroup {
  dateKey: string;
  datetime: number;
  dateLabel: string;
  senderGroups: SenderGroup[];
}

export type AlbumType = 'media' | 'files';

export interface MessageAlbum {
  albumId: string;
  albumType?: AlbumType;
  messages: Message[];
  mainMessage: Message;
  captionMessage?: Message;
  hasMultipleCaptions?: boolean;
}

export type FlatListItem =
  | {
      kind: 'date';
      id: string;
      label: string;
    }
  | {
      kind: 'unread-divider';
      id: 'unread-divider';
    }
  | {
      kind: 'action';
      id: string;
      message: Message;
    }
  | {
      kind: 'message';
      id: string;
      message: Message;
      isOwn: boolean;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
      senderName?: string;
      senderPeerId?: string;
      album?: MessageAlbum;
    }
  | {
      kind: 'album';
      id: string;
      album: MessageAlbum;
      message: Message;
      isOwn: boolean;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
      senderName?: string;
      senderPeerId?: string;
    };

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatMessageDateHeader(unixSeconds: number, now = new Date()): string {
  if (!unixSeconds) return '';
  const date = new Date(unixSeconds * 1000);
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((nowDate - msgDate) / 86_400_000);

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';

  const month = MONTH_NAMES[date.getMonth()];
  const day = date.getDate();

  if (date.getFullYear() === now.getFullYear()) {
    return `${month} ${day}`;
  }
  return `${month} ${day}, ${date.getFullYear()}`;
}

export function isActionMessage(message: Message): boolean {
  return message.kind === 'service' || Boolean(message.action);
}

export function getSenderId(message: Message): string {
  if (message.fromId) return String(message.fromId);
  return String(message.peerId || '');
}

/**
 * Transforms an array/iterable of Message models into structured
 * date groups and consecutive sender groups.
 */
export function groupMessages(messages: Iterable<Message>): MessageDateGroup[] {
  const validMessages = [...messages].filter((m) => !m.isEmpty && m.date > 0);

  // Sort chronologically ascending
  validMessages.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date - b.date;
    }
    return Number(a.id) - Number(b.id);
  });

  const dateGroups: MessageDateGroup[] = [];
  let currentDateGroup: MessageDateGroup | null = null;
  let currentSenderGroup: SenderGroup | null = null;

  for (const message of validMessages) {
    const msgDate = new Date(message.date * 1000);
    const dateKey = `${msgDate.getFullYear()}-${msgDate.getMonth() + 1}-${msgDate.getDate()}`;
    const isAction = isActionMessage(message);
    const senderId = getSenderId(message);
    const isOwn = Boolean(message.out);

    // If date changed, finalize current date group and start new one
    if (!currentDateGroup || currentDateGroup.dateKey !== dateKey) {
      currentDateGroup = {
        dateKey,
        datetime: message.date,
        dateLabel: formatMessageDateHeader(message.date),
        senderGroups: [],
      };
      dateGroups.push(currentDateGroup);
      currentSenderGroup = null;
    }

    // Action messages always get their own individual group
    if (isAction) {
      currentSenderGroup = {
        senderId,
        isOwn,
        isAction: true,
        messages: [message],
      };
      currentDateGroup.senderGroups.push(currentSenderGroup);
      currentSenderGroup = null;
      continue;
    }

    // Check if we can append to the existing sender group
    if (
      currentSenderGroup &&
      !currentSenderGroup.isAction &&
      currentSenderGroup.senderId === senderId &&
      currentSenderGroup.isOwn === isOwn
    ) {
      currentSenderGroup.messages.push(message);
    } else {
      currentSenderGroup = {
        senderId,
        isOwn,
        isAction: false,
        messages: [message],
      };
      currentDateGroup.senderGroups.push(currentSenderGroup);
    }
  }

  return dateGroups;
}

export type BuildFlatMessageItemsOptions = {
  unreadDividerBeforeId?: string;
};

export function flatListItemContainsMessageId(
  item: FlatListItem,
  messageId: string,
): boolean {
  if (item.kind === 'message' || item.kind === 'action') {
    return item.message.id === messageId;
  }
  if (item.kind === 'album') {
    return (
      item.album.mainMessage.id === messageId
      || item.album.messages.some((m) => m.id === messageId)
    );
  }
  return false;
}

function flatItemMatchesUnreadId(item: FlatListItem, unreadDividerBeforeId: string): boolean {
  return flatListItemContainsMessageId(item, unreadDividerBeforeId);
}

export function insertUnreadDivider(
  items: FlatListItem[],
  unreadDividerBeforeId?: string,
): FlatListItem[] {
  if (!unreadDividerBeforeId) {
    return items;
  }
  const index = items.findIndex((item) => flatItemMatchesUnreadId(item, unreadDividerBeforeId));
  if (index === -1) {
    return items;
  }
  const next = [...items];
  next.splice(index, 0, { kind: 'unread-divider', id: 'unread-divider' });
  return next;
}

/**
 * Builds a flat list of items (dates, action messages, and message bubbles)
 * suitable for virtualized rendering.
 */
export function buildFlatMessageItems(
  messages: Iterable<Message>,
  isGroup: boolean = false,
  options?: BuildFlatMessageItemsOptions,
): FlatListItem[] {
  const dateGroups = groupMessages(messages);
  const items: FlatListItem[] = [];

  for (const dateGroup of dateGroups) {
    // Date separator
    items.push({
      kind: 'date',
      id: `date-${dateGroup.dateKey}`,
      label: dateGroup.dateLabel,
    });

    for (const senderGroup of dateGroup.senderGroups) {
      if (senderGroup.isAction) {
        for (const msg of senderGroup.messages) {
          items.push({
            kind: 'action',
            id: `action-${msg.id}`,
            message: msg,
          });
        }
        continue;
      }

      const senderName =
        isGroup && !senderGroup.isOwn && senderGroup.senderId
          ? fallbackPeerDisplay(senderGroup.senderId).name
          : undefined;

      type GroupedEntry =
        | { type: 'message'; message: Message }
        | { type: 'album'; album: MessageAlbum };
      const groupedEntries: GroupedEntry[] = [];
      let activeAlbum: MessageAlbum | null = null;

      for (const msg of senderGroup.messages) {
        const isMediaGroup = msg.isInAlbum && Boolean(msg.groupedId);
        const isFileGroup = msg.isInFileGroup && Boolean(msg.groupedId);

        if ((isMediaGroup || isFileGroup) && msg.groupedId) {
          const albumType: AlbumType = isMediaGroup ? 'media' : 'files';
          if (
            !activeAlbum ||
            activeAlbum.albumId !== msg.groupedId ||
            activeAlbum.albumType !== albumType
          ) {
            activeAlbum = {
              albumId: msg.groupedId,
              albumType,
              messages: [msg],
              mainMessage: msg,
              hasMultipleCaptions: false,
              captionMessage: msg.message?.trim() ? msg : undefined,
            };
            groupedEntries.push({ type: 'album', album: activeAlbum });
          } else {
            activeAlbum.messages.push(msg);
            if (msg.message?.trim()) {
              if (activeAlbum.captionMessage) {
                activeAlbum.hasMultipleCaptions = true;
              } else {
                activeAlbum.captionMessage = msg;
              }
            }
          }
        } else {
          activeAlbum = null;
          groupedEntries.push({ type: 'message', message: msg });
        }
      }

      const count = groupedEntries.length;
      for (let i = 0; i < count; i++) {
        const entry = groupedEntries[i];
        const isFirstInGroup = i === 0;
        const isLastInGroup = i === count - 1;

        if (entry.type === 'album') {
          items.push({
            kind: 'album',
            id: `album-${entry.album.albumId}`,
            album: entry.album,
            message: entry.album.mainMessage,
            isOwn: senderGroup.isOwn,
            isFirstInGroup,
            isLastInGroup,
            senderName,
            senderPeerId: senderGroup.senderId,
          });
        } else {
          items.push({
            kind: 'message',
            id: `msg-${entry.message.id}`,
            message: entry.message,
            isOwn: senderGroup.isOwn,
            isFirstInGroup,
            isLastInGroup,
            senderName,
            senderPeerId: senderGroup.senderId,
          });
        }
      }
    }
  }

  return insertUnreadDivider(items, options?.unreadDividerBeforeId);
}
