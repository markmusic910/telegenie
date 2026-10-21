import { DialogOrderTracker } from './dialog.order-tracker';
import type { StoreSyncPayload } from '../worker/store-sync';

function dialog(peerId: string, topMessage: number, extras: Record<string, unknown> = {}) {
  return {
    peer: { userId: peerId },
    topMessage,
    unreadCount: 0,
    pinned: false,
    ...extras,
  };
}

function message(peerId: string, id: number, date: number) {
  return {
    id,
    date,
    message: 'x',
    peer_id: { userId: peerId },
  };
}

function putNew(peerId: string, id: number, date: number): StoreSyncPayload {
  return {
    type: 'message.put',
    op: 'new',
    messages: [message(peerId, id, date) as never],
    messageServices: [],
    emptyMessages: [],
  };
}

describe('DialogOrderTracker', () => {
  it('does not flush before seed', () => {
    const tracker = new DialogOrderTracker();
    tracker.apply(putNew('7', 1, 100));
    expect(tracker.flush()).toBeUndefined();
    expect(tracker.isSeeded).toBe(false);
  });

  it('seeds from getDialogs pages and sorts by activity then pin', () => {
    const tracker = new DialogOrderTracker();
    tracker.ingestPage({
      dialogs: [
        dialog('1', 10) as never,
        dialog('2', 20, { pinned: true }) as never,
        dialog('3', 30) as never,
      ],
      dialogFolders: [],
      messages: [
        message('1', 10, 100) as never,
        message('2', 20, 50) as never,
        message('3', 30, 300) as never,
      ],
      messageServices: [],
    });
    expect(tracker.flush()).toEqual({ ids: ['2', '3', '1'], allIds: ['2', '3', '1'] });
    expect(tracker.flush()).toBeUndefined();
  });

  it('moves a dialog when a newer message arrives after seed', () => {
    const tracker = new DialogOrderTracker();
    tracker.ingestPage({
      dialogs: [dialog('1', 1) as never, dialog('2', 1) as never],
      dialogFolders: [],
      messages: [message('1', 1, 10) as never, message('2', 1, 20) as never],
      messageServices: [],
    });
    expect(tracker.flush()).toEqual({ ids: ['2', '1'], allIds: ['2', '1'] });

    tracker.apply(putNew('1', 2, 50));
    expect(tracker.flush()).toEqual({ ids: ['1', '2'], allIds: ['1', '2'] });
  });

  it('does not emit for unread-only payloads', () => {
    const tracker = new DialogOrderTracker();
    tracker.ingestPage({
      dialogs: [dialog('1', 1) as never],
      dialogFolders: [],
      messages: [message('1', 1, 10) as never],
      messageServices: [],
    });
    expect(tracker.flush()).toEqual({ ids: ['1'], allIds: ['1'] });
    tracker.apply({ type: 'unreadMark', peerId: '1', unread: true });
    tracker.apply({
      type: 'read.inbox',
      peerId: '1',
      maxId: 1,
      stillUnreadCount: 0,
    });
    expect(tracker.flush()).toBeUndefined();
  });

  it('keeps folder rows out of both scopes and archived dialogs out of the main list', () => {
    const tracker = new DialogOrderTracker();
    tracker.ingestPage({
      dialogs: [
        dialog('1', 1) as never,
        dialog('2', 1, { folderId: 1 }) as never,
      ],
      dialogFolders: [
        {
          peer: { userId: '99' },
          topMessage: 0,
          pinned: false,
          folder: { id: 0, title: 'Archive' },
          unreadMutedPeersCount: 0,
          unreadUnmutedPeersCount: 0,
          unreadMutedMessagesCount: 0,
          unreadUnmutedMessagesCount: 0,
        } as never,
      ],
      messages: [message('1', 1, 10) as never, message('2', 1, 99) as never],
      messageServices: [],
    });
    // '2' is archived: absent from `ids`, ranked by activity in `allIds`.
    // '99' is a DialogFolder row and never appears in either.
    expect(tracker.flush()).toEqual({ ids: ['1'], allIds: ['2', '1'] });
  });

  it('stamps the queried folderId on rows that omit it', () => {
    const tracker = new DialogOrderTracker();
    tracker.ingestPage({
      dialogs: [dialog('1', 1) as never],
      dialogFolders: [],
      messages: [message('1', 1, 10) as never],
      messageServices: [],
    });
    expect(tracker.flush()).toEqual({ ids: ['1'], allIds: ['1'] });

    tracker.ingestPage(
      {
        dialogs: [dialog('2', 1) as never],
        dialogFolders: [],
        messages: [message('2', 1, 99) as never],
        messageServices: [],
      },
      { folderId: 1 },
    );
    expect(tracker.flush()).toEqual({ ids: ['1'], allIds: ['2', '1'] });
  });

  it('reorders pinned dialogs and reports pinnedPeerIds', () => {
    const tracker = new DialogOrderTracker();
    tracker.ingestPage({
      dialogs: [
        dialog('1', 1, { pinned: true }) as never,
        dialog('2', 1, { pinned: true }) as never,
        dialog('3', 1) as never,
      ],
      dialogFolders: [],
      messages: [
        message('1', 1, 10) as never,
        message('2', 1, 20) as never,
        message('3', 1, 30) as never,
      ],
      messageServices: [],
    });
    expect(tracker.flush()).toEqual({ ids: ['1', '2', '3'], allIds: ['1', '2', '3'] });
    expect(tracker.pinnedPeerIds()).toEqual(['1', '2']);

    tracker.apply({ type: 'pinnedDialogs', peerIds: ['2', '1'] });
    expect(tracker.flush()).toEqual({ ids: ['2', '1', '3'], allIds: ['2', '1', '3'] });
    expect(tracker.pinnedPeerIds()).toEqual(['2', '1']);
  });
});
