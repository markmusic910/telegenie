import type { DialogFilterEntity } from '../../store/types';
import { ALL_CHATS_FOLDER_ID } from './dialog-filter.constants';

/** Archived chats live in Telegram folder 1. */
export const ARCHIVE_FOLDER_ID = 1;

export type FolderPeerKind = 'user' | 'group' | 'broadcast';

/**
 * The per-dialog facts a folder rule can test. Kept free of store types so the
 * predicate stays pure and unit-testable.
 */
export type FolderCandidate = {
  peerId: string;
  /**
   * Basic chats and supergroups are both `'group'`; only broadcast channels are
   * `'broadcast'`. A peer id alone cannot tell those apart, so the caller must
   * consult the channel entity.
   */
  kind: FolderPeerKind;
  /** Telegram folder: 0 = main list, 1 = archive. */
  folderId: number;
  unread: boolean;
  muted: boolean;
  isBot?: boolean;
  isContact?: boolean;
};

/** Pre-built id sets so membership tests are O(1) per dialog. */
export type FolderRule = {
  filter: DialogFilterEntity;
  include: Set<string>;
  exclude: Set<string>;
  pinned: string[];
  hasCategoryFlags: boolean;
};

/**
 * Telegram's built-in Unread tab is a normal server `dialogFilter`: all chat
 * categories enabled with `excludeRead` (and usually `excludeArchived`).
 */
export function isUnreadFolder(filter: DialogFilterEntity): boolean {
  if (filter.isDefault || filter.isChatlist) return false;
  return Boolean(
    filter.excludeRead &&
      filter.contacts &&
      filter.nonContacts &&
      filter.groups &&
      filter.broadcasts &&
      filter.bots,
  );
}

export function buildFolderRule(filter: DialogFilterEntity): FolderRule {
  const pinned = filter.pinnedPeerIds ?? [];
  return {
    filter,
    // Pinned peers are implicitly included.
    include: new Set([...pinned, ...(filter.includePeerIds ?? [])]),
    exclude: new Set(filter.excludePeerIds ?? []),
    pinned,
    hasCategoryFlags: Boolean(
      filter.contacts || filter.nonContacts || filter.groups || filter.broadcasts || filter.bots,
    ),
  };
}

function matchesCategory(filter: DialogFilterEntity, d: FolderCandidate): boolean {
  if (d.kind === 'group') return Boolean(filter.groups);
  if (d.kind === 'broadcast') return Boolean(filter.broadcasts);
  // Bots are tested before contact status, matching Telegram's category split.
  if (d.isBot) return Boolean(filter.bots);
  if (d.isContact) return Boolean(filter.contacts);
  return Boolean(filter.nonContacts);
}

/**
 * Whether a dialog belongs to a folder.
 *
 * Precedence follows Telegram Desktop: an explicitly included (or pinned) chat
 * is always in, regardless of the exclusion flags. Otherwise the chat must
 * match a category flag, survive the exclusion flags, and not be excluded.
 */
export function matchesFolderRule(rule: FolderRule, d: FolderCandidate): boolean {
  const { filter } = rule;

  if (filter.id === ALL_CHATS_FOLDER_ID) {
    return d.folderId === 0;
  }

  if (rule.include.has(d.peerId)) {
    return true;
  }
  if (rule.exclude.has(d.peerId)) {
    return false;
  }
  // A chatlist folder is a pure list: no category flags to fall back on.
  if (rule.filter.isChatlist || !rule.hasCategoryFlags) {
    return false;
  }
  if (!matchesCategory(filter, d)) {
    return false;
  }
  if (filter.excludeMuted && d.muted) {
    return false;
  }
  if (filter.excludeRead && !d.unread) {
    return false;
  }
  if (filter.excludeArchived && d.folderId === ARCHIVE_FOLDER_ID) {
    return false;
  }
  return true;
}

export function matchesFolder(filter: DialogFilterEntity, d: FolderCandidate): boolean {
  return matchesFolderRule(buildFolderRule(filter), d);
}

/**
 * Whether a folder can contain archived chats. Drives which worker-ranked order
 * list the UI reads: the archive-inclusive one, or the main list only.
 */
export function folderIncludesArchived(filter: DialogFilterEntity): boolean {
  if (filter.id === ALL_CHATS_FOLDER_ID || isUnreadFolder(filter)) {
    return false;
  }
  return !filter.excludeArchived;
}

/**
 * Order a folder's dialogs: its pinned peers first (in folder pin order), then
 * the remaining ids in the worker-supplied ranking.
 */
export function orderFolderIds(rule: FolderRule, matchedIds: string[]): string[] {
  if (rule.pinned.length === 0) return matchedIds;
  const matched = new Set(matchedIds);
  const head: string[] = [];
  for (const id of rule.pinned) {
    if (matched.has(id)) head.push(id);
  }
  if (head.length === 0) return matchedIds;
  const pinnedSet = new Set(head);
  return [...head, ...matchedIds.filter((id) => !pinnedSet.has(id))];
}
