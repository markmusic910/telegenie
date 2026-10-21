import { Api } from '@telegenie/teleproto';

import { markedPeerIdFromApiInputPeer } from '../../helpers/peer-id.helper';
import { convertTypeTextWithEntities } from './input.converter';

/**
 * A chat folder (`messages.dialogFilter`) flattened into a structured-cloneable
 * shape whose peer lists are already Bot API / TDLib dialog ids.
 *
 * Membership is a rule set, not a list: Telegram has no RPC that enumerates a
 * folder's chats, so clients evaluate these fields locally against their dialogs.
 *
 * @see https://core.telegram.org/constructor/dialogFilter
 */
export type FolderFilter = {
  /** `0` for the default "All Chats" folder (`dialogFilterDefault`). */
  id: number;
  title: string;
  emoticon?: string;
  color?: number;
  /** `dialogFilterChatlist` (shared folder link) — explicit peer lists only, no category flags. */
  isChatlist: boolean;
  contacts?: boolean;
  nonContacts?: boolean;
  groups?: boolean;
  broadcasts?: boolean;
  bots?: boolean;
  excludeMuted?: boolean;
  excludeRead?: boolean;
  excludeArchived?: boolean;
  pinnedPeerIds: string[];
  includePeerIds: string[];
  excludePeerIds: string[];
};

export type DialogFilterBatch = {
  filters: FolderFilter[];
  /** Folder ids in server order; `0` is All Chats. */
  order: number[];
  tagsEnabled?: boolean;
};

/** All Chats — `dialogFilterDefault` carries no id of its own. */
export const DEFAULT_FOLDER_FILTER_ID = 0;

function toPeerIds(peers: Api.TypeInputPeer[] | undefined, selfId?: string): string[] {
  if (!peers?.length) return [];
  const ids: string[] = [];
  for (const peer of peers) {
    const id = markedPeerIdFromApiInputPeer(peer, selfId);
    if (id) ids.push(id);
  }
  return ids;
}

function titleOf(title: Api.TypeTextWithEntities | undefined): string {
  if (!title) return '';
  return convertTypeTextWithEntities(title).text ?? '';
}

export function convertTypeDialogFilter(
  filter: Api.TypeDialogFilter,
  selfId?: string,
): FolderFilter | undefined {
  if (filter instanceof Api.DialogFilterDefault) {
    return {
      id: DEFAULT_FOLDER_FILTER_ID,
      title: 'All Chats',
      isChatlist: false,
      pinnedPeerIds: [],
      includePeerIds: [],
      excludePeerIds: [],
    };
  }

  if (filter instanceof Api.DialogFilterChatlist) {
    return {
      id: filter.id,
      title: titleOf(filter.title),
      emoticon: filter.emoticon,
      color: filter.color,
      isChatlist: true,
      pinnedPeerIds: toPeerIds(filter.pinnedPeers, selfId),
      includePeerIds: toPeerIds(filter.includePeers, selfId),
      excludePeerIds: [],
    };
  }

  if (filter instanceof Api.DialogFilter) {
    return {
      id: filter.id,
      title: titleOf(filter.title),
      emoticon: filter.emoticon,
      color: filter.color,
      isChatlist: false,
      contacts: filter.contacts,
      nonContacts: filter.nonContacts,
      groups: filter.groups,
      broadcasts: filter.broadcasts,
      bots: filter.bots,
      excludeMuted: filter.excludeMuted,
      excludeRead: filter.excludeRead,
      excludeArchived: filter.excludeArchived,
      pinnedPeerIds: toPeerIds(filter.pinnedPeers, selfId),
      includePeerIds: toPeerIds(filter.includePeers, selfId),
      excludePeerIds: toPeerIds(filter.excludePeers, selfId),
    };
  }

  return undefined;
}

export function convertDialogFilters(
  raw: Api.messages.DialogFilters,
  selfId?: string,
): DialogFilterBatch {
  const filters: FolderFilter[] = [];
  for (const filter of raw.filters ?? []) {
    const converted = convertTypeDialogFilter(filter, selfId);
    if (converted) filters.push(converted);
  }
  return {
    filters,
    order: filters.map((filter) => filter.id),
    tagsEnabled: raw.tagsEnabled,
  };
}
