'use client';

import {
  buildFolderRule,
  Dialog,
  folderIncludesArchived,
  matchesFolderRule,
  orderFolderIds,
  type DialogFilterEntity,
  type FolderCandidate,
  type FolderPeerKind,
} from '@telegenie/sdk';

import { useStore } from '@/lib/contexts/sdk.context';

export type FolderDialogIds = {
  /** Dialog ids in the folder, in display order. */
  ids: string[];
  /** Dialogs in the folder with unread messages or an unread mark. */
  unreadCount: number;
};

const EMPTY: FolderDialogIds = { ids: [], unreadCount: 0 };

/**
 * Resolve which dialogs belong to a folder and in what order.
 *
 * Telegram never sends a folder's chat list, only its rules, so membership is
 * evaluated here against the loaded dialogs. Ranking still comes from the
 * SharedWorker: this only filters that order, then hoists the folder's own
 * pinned peers.
 */
export function useFolderDialogIds(filter: DialogFilterEntity | null): FolderDialogIds {
  const dialogStore = useStore('dialog');
  const userStore = useStore('user');
  const channelStore = useStore('channel');
  const globalStore = useStore('global');

  const dialogs = dialogStore.getAllData();
  const users = userStore.getAllData();
  const channels = channelStore.getAllData();

  const baseOrder =
    filter && folderIncludesArchived(filter)
      ? globalStore.nav.sortedDialogIdsWithArchived
      : globalStore.nav.sortedDialogIds;

  // Before the first `dialogOrder` event, fall back to whatever is in the store.
  const order =
    baseOrder.length > 0
      ? baseOrder
      : Array.from(dialogs.values())
          .filter((dialog) => {
            if (dialog.isFolder) return false;
            const scope = dialog.folderId ?? 0;
            if (filter && folderIncludesArchived(filter)) return scope <= 1;
            return scope === 0;
          })
          .map((dialog) => dialog.id);

  if (!filter) return EMPTY;

  const rule = buildFolderRule(filter);
  const matched: string[] = [];
  let unreadCount = 0;

  for (const dialogId of order) {
    const dialog = dialogs.get(dialogId);
    if (!dialog || dialog.isFolder || !dialog.peerId) continue;

    const peerId = dialog.peerId;
    const peerKind = Dialog.peerKindFromId(peerId);
    // A channel id can be a broadcast or a supergroup; only the entity knows.
    const kind: FolderPeerKind =
      peerKind === 'user'
        ? 'user'
        : peerKind === 'chat' || channels.get(peerId)?.megagroup
          ? 'group'
          : 'broadcast';
    const user = peerKind === 'user' ? users.get(peerId) : undefined;
    const unread = dialog.unreadCount > 0 || Boolean(dialog.unreadMark);

    const candidate: FolderCandidate = {
      peerId,
      kind,
      folderId: dialog.folderId ?? 0,
      unread,
      muted: dialog.isMuted,
      isBot: user?.bot,
      isContact: user?.contact,
    };

    if (!matchesFolderRule(rule, candidate)) continue;
    matched.push(dialogId);
    if (unread) unreadCount += 1;
  }

  return { ids: orderFolderIds(rule, matched), unreadCount };
}
