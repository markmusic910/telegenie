import { Api } from '@telegenie/teleproto';

import { markedPeerIdFromApiInputPeer } from '../../helpers/peer-id.helper';
import type { CustomEmojiEntity } from '../message.service';
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
  /** Custom emoji spans inside `title` (`MessageEntityCustomEmoji`). */
  titleEntities?: CustomEmojiEntity[];
  /** When true, custom emojis in the folder title are rendered statically. */
  titleNoanimate?: boolean;
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

/**
 * Payload sent to `messages.updateDialogFilter` to create or update a folder.
 * Uses Bot API / TDLib peer ids; `DialogFilterService` resolves them to
 * `Api.TypeInputPeer` before invoking MTProto.
 */
export type SaveFolderFilterInput = {
  id: number;
  title: string;
  titleEntities?: CustomEmojiEntity[];
  titleNoanimate?: boolean;
  emoticon?: string;
  color?: number;
  isChatlist?: boolean;
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

function convertTitle(title: Api.TypeTextWithEntities | undefined): {
  text: string;
  entities?: CustomEmojiEntity[];
} {
  if (!title) return { text: '' };
  const converted = convertTypeTextWithEntities(title);
  const customEmojis: CustomEmojiEntity[] = [];
  for (const entity of converted.entities ?? []) {
    if (
      entity.className === 'MessageEntityCustomEmoji' &&
      'documentId' in entity &&
      typeof entity.documentId === 'string'
    ) {
      customEmojis.push({
        offset: entity.offset,
        length: entity.length,
        documentId: entity.documentId,
      });
    }
  }
  return {
    text: converted.text ?? '',
    ...(customEmojis.length > 0 ? { entities: customEmojis } : {}),
  };
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
    const title = convertTitle(filter.title);
    return {
      id: filter.id,
      title: title.text,
      titleEntities: title.entities,
      titleNoanimate: filter.titleNoanimate || undefined,
      emoticon: filter.emoticon,
      color: filter.color,
      isChatlist: true,
      pinnedPeerIds: toPeerIds(filter.pinnedPeers, selfId),
      includePeerIds: toPeerIds(filter.includePeers, selfId),
      excludePeerIds: [],
    };
  }

  if (filter instanceof Api.DialogFilter) {
    const title = convertTitle(filter.title);
    return {
      id: filter.id,
      title: title.text,
      titleEntities: title.entities,
      titleNoanimate: filter.titleNoanimate || undefined,
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
