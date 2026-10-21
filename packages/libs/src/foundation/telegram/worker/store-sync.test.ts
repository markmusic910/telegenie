import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { buildMarkedPeerIdByType } from '../helpers/peer-id.helper';
import { toStoreSyncPayloads } from './store-sync';

describe('toStoreSyncPayloads', () => {
  it('converts UpdateNewMessage to message.put', () => {
    const payloads = toStoreSyncPayloads(
      new Api.UpdateNewMessage({
        message: new Api.Message({
          id: 55,
          peerId: new Api.PeerUser({ userId: bigInt(7) }),
          message: 'hello',
          date: 100,
        }),
        pts: 11,
        ptsCount: 1,
      }),
    );
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      type: 'message.put',
      op: 'new',
    });
    if (payloads[0].type === 'message.put') {
      expect(payloads[0].messages[0]).toMatchObject({
        id: 55,
        message: 'hello',
        date: 100,
        peer_id: { userId: '7' },
      });
    }
  });

  it('converts UpdateEditChannelMessage to message.put edit', () => {
    const payloads = toStoreSyncPayloads(
      new Api.UpdateEditChannelMessage({
        message: new Api.Message({
          id: 3,
          peerId: new Api.PeerChannel({ channelId: bigInt(9) }),
          message: 'edited',
          date: 2,
        }),
        pts: 4,
        ptsCount: 1,
      }),
    );
    expect(payloads[0]).toMatchObject({ type: 'message.put', op: 'edit' });
  });

  it('converts UpdateDeleteMessages without peerId', () => {
    expect(
      toStoreSyncPayloads(
        new Api.UpdateDeleteMessages({
          messages: [1, 2],
          pts: 12,
          ptsCount: 2,
        }),
      ),
    ).toEqual([{ type: 'message.delete', ids: [1, 2] }]);
  });

  it('converts UpdateDeleteChannelMessages with marked channel peerId', () => {
    const payloads = toStoreSyncPayloads(
      new Api.UpdateDeleteChannelMessages({
        channelId: bigInt(9),
        messages: [8],
        pts: 5,
        ptsCount: 1,
      }),
    );
    expect(payloads).toEqual([
      {
        type: 'message.delete',
        peerId: buildMarkedPeerIdByType('9', 'channel'),
        ids: [8],
      },
    ]);
  });

  it('converts UpdateMessageReactions to a message.patch', () => {
    const peerId = buildMarkedPeerIdByType('7', 'user');
    const payloads = toStoreSyncPayloads(
      new Api.UpdateMessageReactions({
        peer: new Api.PeerUser({ userId: bigInt(7) }),
        msgId: 12,
        reactions: new Api.MessageReactions({
          results: [
            new Api.ReactionCount({
              reaction: new Api.ReactionEmoji({ emoticon: '👍' }),
              count: 2,
              chosenOrder: 0,
            }),
          ],
        }),
      }),
    );
    expect(payloads).toEqual([
      {
        type: 'message.patch',
        peerId,
        patches: [
          {
            id: 12,
            reactions: {
              min: false,
              canSeeList: false,
              reactionsAsTags: false,
              results: [{ reaction: { emoticon: '👍' }, count: 2, chosenOrder: 0 }],
              recentReactions: undefined,
              topReactors: undefined,
            },
          },
        ],
      },
    ]);
  });

  it('converts channel message views and forwards to message.patch', () => {
    const channelPeerId = buildMarkedPeerIdByType('9', 'channel');
    expect(
      toStoreSyncPayloads(
        new Api.UpdateChannelMessageViews({
          channelId: bigInt(9),
          id: 12,
          views: 100,
        }),
      ),
    ).toEqual([
      {
        type: 'message.patch',
        peerId: channelPeerId,
        patches: [{ id: 12, views: 100 }],
      },
    ]);
    expect(
      toStoreSyncPayloads(
        new Api.UpdateChannelMessageForwards({
          channelId: bigInt(9),
          id: 12,
          forwards: 3,
        }),
      ),
    ).toEqual([
      {
        type: 'message.patch',
        peerId: channelPeerId,
        patches: [{ id: 12, forwards: 3 }],
      },
    ]);
  });

  it('converts content-read updates', () => {
    expect(
      toStoreSyncPayloads(
        new Api.UpdateReadMessagesContents({
          messages: [20, 21],
          pts: 4,
          ptsCount: 2,
        }),
      ),
    ).toEqual([{ type: 'read.contents', ids: [20, 21] }]);

    expect(
      toStoreSyncPayloads(
        new Api.UpdateChannelReadMessagesContents({
          channelId: bigInt(9),
          messages: [8],
        }),
      ),
    ).toEqual([
      {
        type: 'read.contents',
        peerId: buildMarkedPeerIdByType('9', 'channel'),
        ids: [8],
      },
    ]);
  });

  it('converts inbox read, draft, pin, and unread mark', () => {
    expect(
      toStoreSyncPayloads(
        new Api.UpdateReadHistoryInbox({
          peer: new Api.PeerUser({ userId: bigInt(7) }),
          maxId: 10,
          stillUnreadCount: 2,
          pts: 13,
          ptsCount: 1,
        }),
      ),
    ).toEqual([
      { type: 'read.inbox', peerId: '7', maxId: 10, stillUnreadCount: 2 },
    ]);

    const draft = toStoreSyncPayloads(
      new Api.UpdateDraftMessage({
        peer: new Api.PeerUser({ userId: bigInt(7) }),
        draft: new Api.DraftMessage({ message: 'hi', date: 9 }),
      }),
    );
    expect(draft[0]).toMatchObject({ type: 'draft', peerId: '7' });
    if (draft[0].type === 'draft') {
      expect(draft[0].draft).toMatchObject({ message: 'hi', date: 9 });
    }

    expect(
      toStoreSyncPayloads(
        new Api.UpdateDialogPinned({
          pinned: true,
          peer: new Api.DialogPeer({ peer: new Api.PeerUser({ userId: bigInt(7) }) }),
        }),
      ),
    ).toEqual([{ type: 'dialogPinned', peerId: '7', pinned: true }]);

    expect(
      toStoreSyncPayloads(
        new Api.UpdateDialogUnreadMark({
          unread: true,
          peer: new Api.DialogPeer({ peer: new Api.PeerUser({ userId: bigInt(7) }) }),
        }),
      ),
    ).toEqual([{ type: 'unreadMark', peerId: '7', unread: true }]);
  });

  it('converts chat folder updates', () => {
    const put = toStoreSyncPayloads(
      new Api.UpdateDialogFilter({
        id: 3,
        filter: new Api.DialogFilter({
          id: 3,
          title: new Api.TextWithEntities({ text: 'Work', entities: [] }),
          groups: true,
          excludeMuted: true,
          pinnedPeers: [],
          includePeers: [new Api.InputPeerChat({ chatId: bigInt(5) })],
          excludePeers: [],
        } as never),
      }),
    );
    expect(put[0]).toMatchObject({ type: 'dialogFilter.put', id: 3 });
    if (put[0].type === 'dialogFilter.put') {
      expect(put[0].filter).toMatchObject({
        id: 3,
        title: 'Work',
        groups: true,
        excludeMuted: true,
        includePeerIds: [buildMarkedPeerIdByType('5', 'chat')],
      });
    }

    // A missing `filter` means the folder was deleted.
    expect(toStoreSyncPayloads(new Api.UpdateDialogFilter({ id: 3 }))).toEqual([
      { type: 'dialogFilter.delete', id: 3 },
    ]);

    expect(toStoreSyncPayloads(new Api.UpdateDialogFilterOrder({ order: [0, 3, 2] }))).toEqual([
      { type: 'dialogFilter.order', order: [0, 3, 2] },
    ]);

    expect(toStoreSyncPayloads(new Api.UpdateDialogFilters())).toEqual([
      { type: 'dialogFilter.reload' },
    ]);
  });

  it('returns empty for ignored constructors', () => {
    expect(
      toStoreSyncPayloads(
        new Api.UpdateUserTyping({
          userId: bigInt(1),
          action: new Api.SendMessageTypingAction(),
        }),
      ),
    ).toEqual([]);
  });
});
