import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { buildMarkedPeerIdByType, peerIdFromMessage } from '../helpers/peer-id.helper';
import {
  classifyUpdatePts,
  getChannelIdFromUpdate,
  sequenceKeyForPts,
  unwrapEnvelope,
} from './process-envelope';
import {
  shortChatMessageToUpdateNewMessage,
  shortMessageToUpdateNewMessage,
  shortSentMessageToUpdateNewMessage,
} from './short-to-update';

describe('short-to-update', () => {
  it('expands UpdateShortMessage to UpdateNewMessage', () => {
    const short = new Api.UpdateShortMessage({
      id: 10,
      userId: bigInt(42),
      message: 'hi',
      pts: 5,
      ptsCount: 1,
      date: 100,
      out: false,
    });
    const update = shortMessageToUpdateNewMessage(short);
    expect(update).toBeInstanceOf(Api.UpdateNewMessage);
    expect(update.pts).toBe(5);
    expect(update.ptsCount).toBe(1);
    expect(update.message).toBeInstanceOf(Api.Message);
    expect((update.message as Api.Message).message).toBe('hi');
  });

  it('expands UpdateShortChatMessage to UpdateNewMessage', () => {
    const short = new Api.UpdateShortChatMessage({
      id: 11,
      fromId: bigInt(1),
      chatId: bigInt(2),
      message: 'group',
      pts: 6,
      ptsCount: 1,
      date: 101,
    });
    const update = shortChatMessageToUpdateNewMessage(short);
    expect(update.message).toBeInstanceOf(Api.Message);
    expect((update.message as Api.Message).peerId).toBeInstanceOf(Api.PeerChat);
  });

  it('expands UpdateShortSentMessage without peer to MessageEmpty', () => {
    const short = new Api.UpdateShortSentMessage({
      id: 12,
      pts: 7,
      ptsCount: 1,
      date: 102,
      out: true,
    });
    const update = shortSentMessageToUpdateNewMessage(short);
    expect(update.message).toBeInstanceOf(Api.MessageEmpty);
  });
});

describe('unwrapEnvelope', () => {
  it('marks UpdatesTooLong', () => {
    const result = unwrapEnvelope(new Api.UpdatesTooLong());
    expect(result.tooLong).toBe(true);
    expect(result.updates).toHaveLength(0);
  });

  it('unwraps Updates with seq', () => {
    const inner = new Api.UpdatePtsChanged();
    const result = unwrapEnvelope(
      new Api.Updates({
        updates: [inner],
        users: [],
        chats: [],
        date: 50,
        seq: 3,
      }),
    );
    expect(result.updates).toEqual([inner]);
    expect(result.seq).toEqual({ seqStart: 3, seq: 3, date: 50 });
  });

  it('unwraps UpdatesCombined with seqStart', () => {
    const result = unwrapEnvelope(
      new Api.UpdatesCombined({
        updates: [],
        users: [],
        chats: [],
        date: 1,
        seqStart: 2,
        seq: 4,
      }),
    );
    expect(result.seq).toEqual({ seqStart: 2, seq: 4, date: 1 });
  });

  it('unwraps UpdateShort', () => {
    const inner = new Api.UpdateUserTyping({
      userId: bigInt(1),
      action: new Api.SendMessageTypingAction(),
    });
    const result = unwrapEnvelope(new Api.UpdateShort({ update: inner, date: 1 }));
    expect(result.updates).toEqual([inner]);
  });

  it('expands short message envelopes', () => {
    const result = unwrapEnvelope(
      new Api.UpdateShortMessage({
        id: 1,
        userId: bigInt(2),
        message: 'x',
        pts: 2,
        ptsCount: 1,
        date: 1,
      }),
    );
    expect(result.updates[0]).toBeInstanceOf(Api.UpdateNewMessage);
  });

  it('expands short chat and sent envelopes', () => {
    const chat = unwrapEnvelope(
      new Api.UpdateShortChatMessage({
        id: 2,
        fromId: bigInt(1),
        chatId: bigInt(3),
        message: 'g',
        pts: 3,
        ptsCount: 1,
        date: 1,
      }),
    );
    expect(chat.updates[0]).toBeInstanceOf(Api.UpdateNewMessage);

    const sent = unwrapEnvelope(
      new Api.UpdateShortSentMessage({
        id: 3,
        pts: 4,
        ptsCount: 1,
        date: 1,
        out: true,
      }),
    );
    expect(sent.updates[0]).toBeInstanceOf(Api.UpdateNewMessage);
  });

  it('passes through TypeUpdate', () => {
    const u = new Api.UpdatePtsChanged();
    expect(unwrapEnvelope(u).updates).toEqual([u]);
  });
});

describe('classifyUpdatePts', () => {
  it('classifies common pts', () => {
    const update = new Api.UpdateNewMessage({
      message: new Api.Message({
        id: 1,
        peerId: new Api.PeerUser({ userId: bigInt(1) }),
        message: 'a',
        date: 1,
      }),
      pts: 10,
      ptsCount: 1,
    });
    expect(classifyUpdatePts(update)).toEqual({
      kind: 'common',
      pts: 10,
      ptsCount: 1,
    });
  });

  it('classifies channel pts from message peer with Bot API id', () => {
    const update = new Api.UpdateNewChannelMessage({
      message: new Api.Message({
        id: 1,
        peerId: new Api.PeerChannel({ channelId: bigInt(123) }),
        message: 'a',
        date: 1,
      }),
      pts: 20,
      ptsCount: 1,
    });
    const kind = classifyUpdatePts(update);
    expect(kind.kind).toBe('channel');
    if (kind.kind === 'channel') {
      expect(kind.pts).toBe(20);
      expect(kind.channelId).toBe(buildMarkedPeerIdByType('123', 'channel'));
      expect(getChannelIdFromUpdate(update)).toBe(kind.channelId);
      expect(peerIdFromMessage(update.message)).toBe(kind.channelId);
    }
  });

  it('classifies qts', () => {
    const update = new Api.UpdateNewEncryptedMessage({
      message: new Api.EncryptedMessage({
        randomId: bigInt(1),
        chatId: 1,
        date: 1,
        bytes: Buffer.from([]),
        file: new Api.EncryptedFileEmpty(),
      } as ConstructorParameters<typeof Api.EncryptedMessage>[0]),
      qts: 5,
    });
    expect(classifyUpdatePts(update)).toEqual({ kind: 'qts', qts: 5 });
  });

  it('classifies channelTooLong', () => {
    const update = new Api.UpdateChannelTooLong({
      channelId: bigInt(99),
      pts: 50,
    });
    const kind = classifyUpdatePts(update);
    expect(kind.kind).toBe('channelTooLong');
  });

  it('classifies channel updates that carry pts without ptsCount', () => {
    const update = new Api.UpdateReadChannelInbox({
      channelId: bigInt(321),
      maxId: 10,
      stillUnreadCount: 0,
      pts: 77,
    });
    expect(classifyUpdatePts(update)).toEqual({
      kind: 'channel',
      channelId: buildMarkedPeerIdByType('321', 'channel'),
      pts: 77,
      ptsCount: 0,
    });
  });

  it('returns none for a channel-class update whose channel cannot be resolved', () => {
    const update = new Api.UpdateNewChannelMessage({
      message: new Api.MessageEmpty({ id: 1 }),
      pts: 4,
      ptsCount: 1,
    });
    expect(getChannelIdFromUpdate(update)).toBeUndefined();
    expect(classifyUpdatePts(update)).toEqual({ kind: 'none' });
  });

  it('returns none for updates without pts or qts', () => {
    expect(classifyUpdatePts(new Api.UpdatePtsChanged())).toEqual({ kind: 'none' });
  });
});

describe('getChannelIdFromUpdate', () => {
  it('marks a plain channelId field', () => {
    const update = new Api.UpdateChannel({ channelId: bigInt(555) });
    expect(getChannelIdFromUpdate(update)).toBe(buildMarkedPeerIdByType('555', 'channel'));
  });

  it('marks the channelId of UpdateChannelTooLong', () => {
    const update = new Api.UpdateChannelTooLong({ channelId: bigInt(4), pts: 1 });
    expect(getChannelIdFromUpdate(update)).toBe(buildMarkedPeerIdByType('4', 'channel'));
  });

  it('returns undefined when the channelId is unparseable', () => {
    const update = {
      className: 'UpdateChannel',
      channelId: { toString: () => 'not-a-number' },
    } as unknown as Api.TypeUpdate;
    expect(getChannelIdFromUpdate(update)).toBeUndefined();
  });

  it('returns undefined for updates with neither channelId nor message', () => {
    const update = new Api.UpdateUserTyping({
      userId: bigInt(1),
      action: new Api.SendMessageTypingAction(),
    });
    expect(getChannelIdFromUpdate(update)).toBeUndefined();
  });

  it('returns undefined when message is not an object', () => {
    const update = new Api.UpdateShortMessage({
      id: 1,
      userId: bigInt(1),
      message: 'text-not-object',
      pts: 1,
      ptsCount: 1,
      date: 1,
    }) as unknown as Api.TypeUpdate;
    expect(getChannelIdFromUpdate(update)).toBeUndefined();
  });

  it('returns undefined when the message peer is not a channel', () => {
    const update = new Api.UpdateNewMessage({
      message: new Api.Message({
        id: 1,
        peerId: new Api.PeerUser({ userId: bigInt(1) }),
        message: 'a',
        date: 1,
      }),
      pts: 1,
      ptsCount: 1,
    });
    expect(getChannelIdFromUpdate(update)).toBeUndefined();
  });

  it('returns undefined when the message has no peer at all', () => {
    const update = new Api.UpdateNewMessage({
      message: new Api.MessageEmpty({ id: 1 }),
      pts: 1,
      ptsCount: 1,
    });
    expect(getChannelIdFromUpdate(update)).toBeUndefined();
  });
});

describe('sequenceKeyForPts', () => {
  it('maps common and qts to the common sequence', () => {
    expect(sequenceKeyForPts({ kind: 'common', pts: 1, ptsCount: 1 })).toBe('common');
    expect(sequenceKeyForPts({ kind: 'qts', qts: 1 })).toBe('common');
  });

  it('maps channel kinds to a per-channel sequence', () => {
    expect(sequenceKeyForPts({ kind: 'channel', channelId: '-1', pts: 1, ptsCount: 1 })).toBe(
      'channel:-1',
    );
    expect(sequenceKeyForPts({ kind: 'channelTooLong', channelId: '-2' })).toBe('channel:-2');
  });

  it('has no sequence for unclassified updates', () => {
    expect(sequenceKeyForPts({ kind: 'none' })).toBeUndefined();
  });
});
