import type { DialogFilterEntity } from '../../store/types';
import { ALL_CHATS_FOLDER } from './dialog-filter.constants';
import {
  buildFolderRule,
  folderIncludesArchived,
  isUnreadFolder,
  matchesFolder,
  orderFolderIds,
  type FolderCandidate,
} from './dialog-filter.matcher';

function folder(overrides: Partial<DialogFilterEntity> = {}): DialogFilterEntity {
  return {
    id: '2',
    folderId: 2,
    title: 'Work',
    isDefault: false,
    isLocal: false,
    isChatlist: false,
    pinnedPeerIds: [],
    includePeerIds: [],
    excludePeerIds: [],
    ...overrides,
  };
}

/** Telegram's suggested/server Unread preset: all categories + exclude read. */
function unreadFolder(overrides: Partial<DialogFilterEntity> = {}): DialogFilterEntity {
  return folder({
    id: '1',
    folderId: 1,
    title: 'Unread',
    contacts: true,
    nonContacts: true,
    groups: true,
    broadcasts: true,
    bots: true,
    excludeRead: true,
    excludeArchived: true,
    ...overrides,
  });
}

function chat(overrides: Partial<FolderCandidate> = {}): FolderCandidate {
  return {
    peerId: '100',
    kind: 'user',
    folderId: 0,
    unread: false,
    muted: false,
    ...overrides,
  };
}

describe('isUnreadFolder', () => {
  it('matches the server Unread preset', () => {
    expect(isUnreadFolder(unreadFolder())).toBe(true);
    expect(isUnreadFolder(folder({ excludeRead: true, groups: true }))).toBe(false);
    expect(isUnreadFolder(ALL_CHATS_FOLDER)).toBe(false);
  });
});

describe('matchesFolder — default folders', () => {
  it('All Chats takes the main list and rejects the archive', () => {
    expect(matchesFolder(ALL_CHATS_FOLDER, chat())).toBe(true);
    expect(matchesFolder(ALL_CHATS_FOLDER, chat({ folderId: 1 }))).toBe(false);
  });

  it('server Unread takes only unread main-list chats', () => {
    const unread = unreadFolder();
    expect(matchesFolder(unread, chat({ unread: true }))).toBe(true);
    expect(matchesFolder(unread, chat({ unread: false }))).toBe(false);
    expect(matchesFolder(unread, chat({ unread: true, folderId: 1 }))).toBe(false);
  });
});

describe('matchesFolder — explicit peer lists', () => {
  it('includes listed peers and excludes the rest', () => {
    const f = folder({ includePeerIds: ['100'] });
    expect(matchesFolder(f, chat({ peerId: '100' }))).toBe(true);
    expect(matchesFolder(f, chat({ peerId: '200' }))).toBe(false);
  });

  it('treats pinned peers as included', () => {
    const f = folder({ pinnedPeerIds: ['100'] });
    expect(matchesFolder(f, chat({ peerId: '100' }))).toBe(true);
  });

  it('lets an explicit include win over the exclusion flags', () => {
    const f = folder({ includePeerIds: ['100'], excludeMuted: true, excludeRead: true });
    expect(matchesFolder(f, chat({ peerId: '100', muted: true, unread: false }))).toBe(true);
  });

  it('drops excluded peers that would otherwise match a category', () => {
    const f = folder({ groups: true, excludePeerIds: ['100'] });
    expect(matchesFolder(f, chat({ peerId: '100', kind: 'group' }))).toBe(false);
    expect(matchesFolder(f, chat({ peerId: '200', kind: 'group' }))).toBe(true);
  });

  it('matches nothing beyond its list for a chatlist folder', () => {
    const f = folder({ isChatlist: true, groups: true, includePeerIds: ['100'] });
    expect(matchesFolder(f, chat({ peerId: '100' }))).toBe(true);
    expect(matchesFolder(f, chat({ peerId: '200', kind: 'group' }))).toBe(false);
  });
});

describe('matchesFolder — category flags', () => {
  it('separates groups from broadcasts', () => {
    const groups = folder({ groups: true });
    expect(matchesFolder(groups, chat({ kind: 'group' }))).toBe(true);
    expect(matchesFolder(groups, chat({ kind: 'broadcast' }))).toBe(false);

    const broadcasts = folder({ broadcasts: true });
    expect(matchesFolder(broadcasts, chat({ kind: 'broadcast' }))).toBe(true);
    expect(matchesFolder(broadcasts, chat({ kind: 'group' }))).toBe(false);
  });

  it('splits users into bots, contacts, and non-contacts', () => {
    expect(matchesFolder(folder({ bots: true }), chat({ isBot: true }))).toBe(true);
    expect(matchesFolder(folder({ contacts: true }), chat({ isBot: true }))).toBe(false);
    expect(matchesFolder(folder({ contacts: true }), chat({ isContact: true }))).toBe(true);
    expect(matchesFolder(folder({ nonContacts: true }), chat({ isContact: false }))).toBe(true);
    expect(matchesFolder(folder({ contacts: true }), chat({ isContact: false }))).toBe(false);
  });

  it('matches nothing when no category flag is set and no peer is listed', () => {
    expect(matchesFolder(folder(), chat({ kind: 'group' }))).toBe(false);
  });

  it('honours excludeMuted, excludeRead, and excludeArchived', () => {
    expect(
      matchesFolder(folder({ groups: true, excludeMuted: true }), chat({ kind: 'group', muted: true })),
    ).toBe(false);
    expect(
      matchesFolder(folder({ groups: true, excludeRead: true }), chat({ kind: 'group', unread: false })),
    ).toBe(false);
    expect(
      matchesFolder(
        folder({ groups: true, excludeArchived: true }),
        chat({ kind: 'group', folderId: 1 }),
      ),
    ).toBe(false);
    expect(
      matchesFolder(folder({ groups: true }), chat({ kind: 'group', folderId: 1 })),
    ).toBe(true);
  });
});

describe('folderIncludesArchived', () => {
  it('is false for All Chats and the server Unread preset', () => {
    expect(folderIncludesArchived(ALL_CHATS_FOLDER)).toBe(false);
    expect(folderIncludesArchived(unreadFolder())).toBe(false);
  });

  it('tracks excludeArchived for server folders', () => {
    expect(folderIncludesArchived(folder())).toBe(true);
    expect(folderIncludesArchived(folder({ excludeArchived: true }))).toBe(false);
  });
});

describe('orderFolderIds', () => {
  it('hoists matched pinned peers in folder pin order', () => {
    const rule = buildFolderRule(folder({ pinnedPeerIds: ['300', '200'] }));
    expect(orderFolderIds(rule, ['100', '200', '300'])).toEqual(['300', '200', '100']);
  });

  it('ignores pinned peers that did not match', () => {
    const rule = buildFolderRule(folder({ pinnedPeerIds: ['999'] }));
    expect(orderFolderIds(rule, ['100', '200'])).toEqual(['100', '200']);
  });

  it('leaves the order untouched without pinned peers', () => {
    const rule = buildFolderRule(folder());
    expect(orderFolderIds(rule, ['100', '200'])).toEqual(['100', '200']);
  });
});
