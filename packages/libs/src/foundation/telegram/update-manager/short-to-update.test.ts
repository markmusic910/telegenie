import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import {
  isShortUpdates,
  shortChatMessageToUpdateNewMessage,
  shortMessageToUpdateNewMessage,
  shortSentMessageToUpdateNewMessage,
} from './short-to-update';

describe('shortMessageToUpdateNewMessage', () => {
  it('keeps the sender for incoming messages', () => {
    const update = shortMessageToUpdateNewMessage(
      new Api.UpdateShortMessage({
        id: 1,
        userId: bigInt(42),
        message: 'in',
        pts: 5,
        ptsCount: 1,
        date: 100,
        out: false,
        mentioned: true,
        mediaUnread: true,
        silent: true,
        ttlPeriod: 60,
      }),
    );
    const message = update.message as Api.Message;
    expect(message.fromId).toBeInstanceOf(Api.PeerUser);
    expect((message.peerId as Api.PeerUser).userId.toString()).toBe('42');
    expect(message.mentioned).toBe(true);
    expect(message.mediaUnread).toBe(true);
    expect(message.silent).toBe(true);
    expect(message.ttlPeriod).toBe(60);
  });

  it('drops the sender for outgoing messages', () => {
    const update = shortMessageToUpdateNewMessage(
      new Api.UpdateShortMessage({
        id: 2,
        userId: bigInt(42),
        message: 'out',
        pts: 6,
        ptsCount: 1,
        date: 100,
        out: true,
      }),
    );
    expect((update.message as Api.Message).fromId).toBeUndefined();
    expect((update.message as Api.Message).out).toBe(true);
  });
});

describe('shortChatMessageToUpdateNewMessage', () => {
  it('splits the chat peer from the sender', () => {
    const update = shortChatMessageToUpdateNewMessage(
      new Api.UpdateShortChatMessage({
        id: 3,
        fromId: bigInt(7),
        chatId: bigInt(9),
        message: 'group',
        pts: 7,
        ptsCount: 1,
        date: 100,
      }),
    );
    const message = update.message as Api.Message;
    expect((message.peerId as Api.PeerChat).chatId.toString()).toBe('9');
    expect((message.fromId as Api.PeerUser).userId.toString()).toBe('7');
  });
});

describe('shortSentMessageToUpdateNewMessage', () => {
  it('builds a real message when the peer is known', () => {
    const peer = new Api.PeerUser({ userId: bigInt(5) });
    const update = shortSentMessageToUpdateNewMessage(
      new Api.UpdateShortSentMessage({
        id: 4,
        pts: 8,
        ptsCount: 1,
        date: 100,
        media: new Api.MessageMediaEmpty(),
        entities: [],
        ttlPeriod: 30,
      }),
      peer,
    );
    const message = update.message as Api.Message;
    expect(message).toBeInstanceOf(Api.Message);
    expect(message.peerId).toBe(peer);
    expect(message.message).toBe('');
    // `out` defaults to true when the short update omits it.
    expect(message.out).toBe(true);
    expect(message.ttlPeriod).toBe(30);
  });

  it('keeps the outgoing text when it is provided', () => {
    const peer = new Api.PeerUser({ userId: bigInt(5) });
    const update = shortSentMessageToUpdateNewMessage(
      new Api.UpdateShortSentMessage({ id: 6, pts: 10, ptsCount: 1, date: 100, out: true }),
      peer,
      'hello',
    );
    const message = update.message as Api.Message;
    expect(message.message).toBe('hello');
    expect(message.out).toBe(true);
    expect(message.replyTo).toBeUndefined();
  });

  it('keeps the reply target when a reply id is provided', () => {
    const peer = new Api.PeerUser({ userId: bigInt(5) });
    const update = shortSentMessageToUpdateNewMessage(
      new Api.UpdateShortSentMessage({ id: 7, pts: 11, ptsCount: 1, date: 100, out: true }),
      peer,
      'hello',
      9,
    );
    const message = update.message as Api.Message;
    expect(message.replyTo).toBeInstanceOf(Api.MessageReplyHeader);
    expect((message.replyTo as Api.MessageReplyHeader).replyToMsgId).toBe(9);
  });

  it('falls back to MessageEmpty so pts is still applied', () => {
    const update = shortSentMessageToUpdateNewMessage(
      new Api.UpdateShortSentMessage({ id: 5, pts: 9, ptsCount: 1, date: 100, out: false }),
    );
    expect(update.message).toBeInstanceOf(Api.MessageEmpty);
    expect(update.pts).toBe(9);
  });
});

describe('isShortUpdates', () => {
  it('accepts every redundant short constructor', () => {
    expect(
      isShortUpdates(
        new Api.UpdateShortMessage({
          id: 1,
          userId: bigInt(1),
          message: 'a',
          pts: 1,
          ptsCount: 1,
          date: 1,
        }),
      ),
    ).toBe(true);
    expect(
      isShortUpdates(
        new Api.UpdateShortChatMessage({
          id: 1,
          fromId: bigInt(1),
          chatId: bigInt(1),
          message: 'a',
          pts: 1,
          ptsCount: 1,
          date: 1,
        }),
      ),
    ).toBe(true);
    expect(
      isShortUpdates(new Api.UpdateShortSentMessage({ id: 1, pts: 1, ptsCount: 1, date: 1 })),
    ).toBe(true);
    expect(
      isShortUpdates(
        new Api.UpdateShort({ update: new Api.UpdatePtsChanged(), date: 1 }),
      ),
    ).toBe(true);
  });

  it('rejects full envelopes and non-updates', () => {
    expect(
      isShortUpdates(
        new Api.Updates({ updates: [], users: [], chats: [], date: 1, seq: 1 }),
      ),
    ).toBe(false);
    expect(isShortUpdates(new Api.UpdatesTooLong())).toBe(false);
    expect(isShortUpdates(undefined)).toBe(false);
    expect(isShortUpdates({ className: 'UpdateShortMessage' })).toBe(false);
  });
});
