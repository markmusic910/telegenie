'use client';

import {
  ALL_CHATS_FOLDER_ID,
  buildFolderRule,
  Dialog,
  matchesFolderRule,
  type DialogFilterEntity,
  type FolderCandidate,
  type FolderPeerKind,
} from '@telegenie/sdk';

import { useStore } from '@/lib/contexts/sdk.context';

const EMPTY_TAGS: readonly DialogFilterEntity[] = [];

/**
 * Resolve which custom folders a dialog belongs to for rendering folder tags
 * in the chat list. Short-circuits immediately when folder tags are disabled
 * or the user is not Telegram Premium.
 */
export function useDialogFolderTags(
  dialog: Dialog | undefined,
): readonly DialogFilterEntity[] {
  const globalStore = useStore('global');
  const filterStore = useStore('dialogFilter');
  const userStore = useStore('user');
  const channelStore = useStore('channel');

  if (
    !dialog ||
    dialog.isFolder ||
    !dialog.peerId ||
    !globalStore.auth.currentUser?.premium ||
    !globalStore.nav.folderTagsEnabled
  ) {
    return EMPTY_TAGS;
  }

  const filters = filterStore.getAllData();
  const sortedIds = globalStore.nav.sortedFolderIds;
  const order = sortedIds.length > 0 ? sortedIds : Array.from(filters.keys());

  const peerId = dialog.peerId;
  const peerKind = Dialog.peerKindFromId(peerId);
  const kind: FolderPeerKind =
    peerKind === 'user'
      ? 'user'
      : peerKind === 'chat' || channelStore.getAllData().get(peerId)?.megagroup
        ? 'group'
        : 'broadcast';
  const user = peerKind === 'user' ? userStore.getAllData().get(peerId) : undefined;

  const candidate: FolderCandidate = {
    peerId,
    kind,
    folderId: dialog.folderId ?? 0,
    unread: dialog.unreadCount > 0 || Boolean(dialog.unreadMark),
    muted: dialog.isMuted,
    isBot: user?.bot,
    isContact: user?.contact,
  };

  const matched: DialogFilterEntity[] = [];
  for (const folderId of order) {
    if (folderId === ALL_CHATS_FOLDER_ID) continue;
    const filter = filters.get(folderId);
    if (!filter || filter.isDefault || !filter.title) continue;
    if (matchesFolderRule(buildFolderRule(filter), candidate)) {
      matched.push(filter);
    }
  }

  return matched.length > 0 ? matched : EMPTY_TAGS;
}
