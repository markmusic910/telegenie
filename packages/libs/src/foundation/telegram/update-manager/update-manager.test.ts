import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { LocalDb } from '../local-db/local-db';
import type { TransportService } from '../services/transport.service';
import { UPDATE_KEYS } from './update-keys';
import { UpdateManager } from './update-manager';

function createDb(slot = `um-${Date.now()}-${Math.random()}`): LocalDb {
  return new LocalDb({ accountSlot: slot, flushDelayMs: 10_000 });
}

type FakeClient = {
  invoke: jest.Mock;
  addEventHandler: jest.Mock;
  removeEventHandler: jest.Mock;
};

function createTransport(client: FakeClient): TransportService {
  return { client, debug: false } as unknown as TransportService;
}

describe('UpdateManager', () => {
  let db: LocalDb;
  let client: FakeClient;
  let manager: UpdateManager;

  beforeEach(async () => {
    db = createDb();
    await db.open();
    await db.setCommonState({ pts: 10, qts: 0, seq: 1, date: 100 });
    client = {
      invoke: jest.fn(),
      addEventHandler: jest.fn(),
      removeEventHandler: jest.fn(),
    };
    manager = new UpdateManager({
      transportService: createTransport(client),
      localDb: db,
      gapWaitMs: 50,
      debug: false,
    });
  });

  afterEach(async () => {
    manager?.stop();
    if (db) {
      try {
        await db.deleteDatabase();
      } catch {
        db.destroy();
      }
    }
  });

  it('exposes exhaustive update keys', () => {
    expect(UPDATE_KEYS.length).toBeGreaterThan(100);
    expect(UPDATE_KEYS).toContain('UpdateNewMessage');
    expect(UPDATE_KEYS).toContain('UpdatePaidReactionPrivacy');
  });

  it('start fetches GetState when missing and registers handler', async () => {
    const emptyDb = createDb();
    await emptyDb.open();
    client.invoke.mockResolvedValue(
      new Api.updates.State({
        pts: 3,
        qts: 0,
        date: 9,
        seq: 1,
        unreadCount: 0,
      }),
    );
    const m = new UpdateManager({
      transportService: createTransport(client),
      localDb: emptyDb,
    });
    await m.start();
    expect(client.invoke).toHaveBeenCalled();
    expect(client.addEventHandler).toHaveBeenCalled();
    const state = await emptyDb.getCommonState();
    expect(state?.pts).toBe(3);
    m.stop();
    expect(client.removeEventHandler).toHaveBeenCalled();
    await emptyDb.deleteDatabase();
  });

  it('dispatches upstream handlers after builtins for UpdateNewMessage', async () => {
    const order: string[] = [];
    manager.on('UpdateNewMessage', async () => {
      order.push('upstream');
    });

    await manager.process(
      new Api.UpdateNewMessage({
        message: new Api.Message({
          id: 55,
          peerId: new Api.PeerUser({ userId: bigInt(7) }),
          message: 'hello',
          date: 1,
        }),
        pts: 11,
        ptsCount: 1,
      }),
    );

    expect(order).toEqual(['upstream']);
    expect(await db.getCommonState()).toMatchObject({ pts: 11 });
    expect(await db.containsMsgId('common', 55)).toBe(true);
  });

  it('supports on/off and onAny', async () => {
    const seen: string[] = [];
    const h = async () => {
      seen.push('h');
    };
    const off = manager.on('UpdateUserTyping', h);
    manager.onAny(async (event) => {
      seen.push(`any:${event}`);
    });

    const update = new Api.UpdateUserTyping({
      userId: bigInt(1),
      action: new Api.SendMessageTypingAction(),
    });
    await manager.process(update);
    expect(seen).toEqual(['h', 'any:UpdateUserTyping']);

    off();
    seen.length = 0;
    await manager.process(update);
    expect(seen).toEqual(['any:UpdateUserTyping']);
  });

  it('skips duplicate pts updates', async () => {
    let count = 0;
    manager.on('UpdateNewMessage', async () => {
      count += 1;
    });
    const make = (pts: number) =>
      new Api.UpdateNewMessage({
        message: new Api.Message({
          id: pts,
          peerId: new Api.PeerUser({ userId: bigInt(1) }),
          message: 'x',
          date: 1,
        }),
        pts,
        ptsCount: 1,
      });

    await manager.process(make(11));
    await manager.process(make(11));
    expect(count).toBe(1);
  });

  it('recovers common gap via getDifference after wait', async () => {
    const gaps: unknown[] = [];
    manager.onControl('gap', (p) => gaps.push(p));

    client.invoke.mockImplementation(async (req) => {
      if (req instanceof Api.updates.GetDifference) {
        return new Api.updates.Difference({
          newMessages: [],
          newEncryptedMessages: [],
          otherUpdates: [],
          chats: [],
          users: [],
          state: new Api.updates.State({
            pts: 20,
            qts: 0,
            date: 200,
            seq: 2,
            unreadCount: 0,
          }),
        });
      }
      throw new Error('unexpected invoke');
    });

    await manager.process(
      new Api.UpdateNewMessage({
        message: new Api.Message({
          id: 99,
          peerId: new Api.PeerUser({ userId: bigInt(1) }),
          message: 'gap',
          date: 1,
        }),
        pts: 20,
        ptsCount: 1,
      }),
    );

    expect(gaps.length).toBe(1);
    expect(client.invoke).toHaveBeenCalled();
    const state = await db.getCommonState();
    expect(state?.pts).toBe(20);
    expect(state?.date).toBe(200);
  }, 10_000);

  it('binds UpdateMessageID random id', async () => {
    await db.putPendingRandomId('12345', '1');
    await manager.process(
      new Api.UpdateMessageID({
        id: 77,
        randomId: bigInt(12345),
      }),
    );
    const row = await db.getRandomId('12345');
    expect(row?.messageId).toBe(77);
  });

  it('watchChannel respects max and emits watchLimitReached', () => {
    const limited: string[] = [];
    const m = new UpdateManager({
      transportService: createTransport(client),
      localDb: db,
      maxWatchedChannels: 1,
    });
    m.onControl('watchLimitReached', (p) => limited.push(p.channelId));
    client.invoke.mockResolvedValue(
      new Api.updates.ChannelDifferenceEmpty({ final: true, pts: 1, timeout: 60 }),
    );
    m.watchChannel('a');
    m.watchChannel('b');
    expect(limited).toEqual(['b']);
    m.unwatchAllChannels();
    m.stop();
  });

  it('handles UpdatesTooLong via getDifference', async () => {
    const seen: string[] = [];
    manager.onControl('updatesTooLong', () => seen.push('tooLong'));
    client.invoke.mockResolvedValue(
      new Api.updates.DifferenceEmpty({ date: 300, seq: 5 }),
    );
    await manager.process(new Api.UpdatesTooLong());
    expect(seen).toEqual(['tooLong']);
    expect(await db.getCommonState()).toMatchObject({ date: 300, seq: 5 });
  });

  it('applies seq from Updates envelope', async () => {
    await manager.process(
      new Api.Updates({
        updates: [
          new Api.UpdateUserTyping({
            userId: bigInt(1),
            action: new Api.SendMessageTypingAction(),
          }),
        ],
        users: [],
        chats: [],
        date: 150,
        seq: 2,
      }),
    );
    expect(await db.getCommonState()).toMatchObject({ seq: 2, date: 150 });
  });

  it('recovers seq gap', async () => {
    client.invoke.mockResolvedValue(
      new Api.updates.DifferenceEmpty({ date: 400, seq: 10 }),
    );
    const gaps: unknown[] = [];
    manager.onControl('gap', (p) => gaps.push(p));
    await manager.process(
      new Api.Updates({
        updates: [],
        users: [],
        chats: [],
        date: 150,
        seq: 9,
      }),
    );
    expect(gaps).toEqual([{ sequence: 'seq' }]);
    expect(await db.getCommonState()).toMatchObject({ date: 400, seq: 10 });
  });

  it('applies channel pts and recovers channel gap', async () => {
    // Bot API / peer-id.helper: -(10^12 + mtpId)
    const channelId = '-1000000000777';
    await db.putChannel({
      id: channelId,
      accessHash: '55',
      title: 'Chan',
      photo: {} as never,
      date: 1,
      min: false,
    });
    await db.setChannelPts(channelId, 5);

    const mtpChannelId = bigInt(777);
    await manager.process(
      new Api.UpdateNewChannelMessage({
        message: new Api.Message({
          id: 1,
          peerId: new Api.PeerChannel({ channelId: mtpChannelId }),
          message: 'c',
          date: 1,
        }),
        pts: 6,
        ptsCount: 1,
      }),
    );
    expect(await db.getChannelPts(channelId)).toBe(6);

    client.invoke.mockResolvedValue(
      new Api.updates.ChannelDifferenceEmpty({
        final: true,
        pts: 20,
        timeout: 1,
      }),
    );
    const gaps: unknown[] = [];
    manager.onControl('gap', (p) => gaps.push(p));
    await manager.process(
      new Api.UpdateNewChannelMessage({
        message: new Api.Message({
          id: 2,
          peerId: new Api.PeerChannel({ channelId: mtpChannelId }),
          message: 'gap',
          date: 1,
        }),
        pts: 20,
        ptsCount: 1,
      }),
    );
    expect(gaps[0]).toMatchObject({ sequence: { channelId } });
    expect(await db.getChannelPts(channelId)).toBe(20);
  }, 10_000);

  it('handles UpdateChannelTooLong', async () => {
    const channelId = '-1000000000888';
    await db.putChannel({
      id: channelId,
      accessHash: '1',
      title: 'C',
      photo: {} as never,
      date: 1,
      min: false,
    });
    client.invoke.mockResolvedValue(
      new Api.updates.ChannelDifferenceEmpty({ final: true, pts: 3, timeout: 1 }),
    );
    const events: string[] = [];
    manager.onControl('channelTooLong', () => events.push('ctl'));
    manager.on('UpdateChannelTooLong', async () => events.push('upd'));
    await manager.process(
      new Api.UpdateChannelTooLong({
        channelId: bigInt(888),
        pts: 3,
      }),
    );
    expect(events).toEqual(['ctl', 'upd']);
  });

  it('notes channel message ids into the channel msg-id box (not common)', async () => {
    const channelId = '-1000000000999';
    await manager.process(
      new Api.UpdateNewChannelMessage({
        message: new Api.Message({
          id: 42,
          peerId: new Api.PeerChannel({ channelId: bigInt(999) }),
          message: 'hi',
          date: 1,
        }),
        pts: 1,
        ptsCount: 1,
      }),
    );
    expect(await db.containsMsgId(channelId, 42)).toBe(true);
    expect(await db.containsMsgId('common', 42)).toBe(false);
  });

  it('applies qts updates', async () => {
    await manager.process(
      new Api.UpdateNewEncryptedMessage({
        message: new Api.EncryptedMessage({
          randomId: bigInt(1),
          chatId: 1,
          date: 1,
          bytes: Buffer.alloc(0),
          file: new Api.EncryptedFileEmpty(),
        }),
        qts: 1,
      }),
    );
    expect(await db.getCommonState()).toMatchObject({ qts: 1 });
  });

  it('swallows handler errors', async () => {
    manager.on('UpdateUserTyping', async () => {
      throw new Error('boom');
    });
    await expect(
      manager.process(
        new Api.UpdateUserTyping({
          userId: bigInt(1),
          action: new Api.SendMessageTypingAction(),
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('persists users/chats from Updates', async () => {
    await manager.process(
      new Api.Updates({
        updates: [],
        users: [
          new Api.User({
            id: bigInt(42),
            accessHash: bigInt(1),
            firstName: 'Ada',
          }),
        ],
        chats: [
          new Api.Chat({
            id: bigInt(10),
            title: 'G',
            photo: new Api.ChatPhotoEmpty(),
            participantsCount: 2,
            date: 1,
            version: 1,
          }),
        ],
        date: 100,
        seq: 1,
      }),
    );
    // seq 1 with local seq 1 → skip seq apply; entities still persisted
    expect(await db.getUser('42')).toMatchObject({ firstName: 'Ada' });
  });

  it('start is idempotent and stop is safe before start', async () => {
    manager.stop();
    client.invoke.mockResolvedValue(
      new Api.updates.State({
        pts: 1,
        qts: 0,
        date: 1,
        seq: 0,
        unreadCount: 0,
      }),
    );
    await manager.start();
    await manager.start();
    expect(client.addEventHandler).toHaveBeenCalledTimes(1);
    manager.stop();
  });

  it('triggers getDifference on UpdatePtsChanged', async () => {
    client.invoke.mockResolvedValue(
      new Api.updates.DifferenceEmpty({ date: 500, seq: 8 }),
    );
    await manager.process(new Api.UpdatePtsChanged());
    expect(client.invoke).toHaveBeenCalled();
    expect(await db.getCommonState()).toMatchObject({ date: 500, seq: 8 });
  });

  it('loops DifferenceSlice then Difference on UpdatePtsChanged', async () => {
    let calls = 0;
    const seen: string[] = [];
    manager.on('UpdatePtsChanged', async () => {
      seen.push('ptsChanged');
    });
    client.invoke.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        return new Api.updates.DifferenceSlice({
          newMessages: [],
          newEncryptedMessages: [],
          otherUpdates: [new Api.UpdatePtsChanged()],
          chats: [],
          users: [],
          intermediateState: new Api.updates.State({
            pts: 15,
            qts: 0,
            date: 110,
            seq: 2,
            unreadCount: 0,
          }),
        });
      }
      return new Api.updates.Difference({
        newMessages: [],
        newEncryptedMessages: [],
        otherUpdates: [],
        chats: [],
        users: [],
        state: new Api.updates.State({
          pts: 18,
          qts: 1,
          date: 120,
          seq: 3,
          unreadCount: 0,
        }),
      });
    });

    await manager.process(new Api.UpdatePtsChanged());
    expect(calls).toBe(2);
    expect(seen).toContain('ptsChanged');
    expect(await db.getCommonState()).toMatchObject({ pts: 18, qts: 1, seq: 3, date: 120 });
  });

  it('handles DifferenceTooLong with GetState reset', async () => {
    const controls: string[] = [];
    manager.onControl('differenceTooLong', () => controls.push('tooLong'));
    client.invoke.mockImplementation(async (req) => {
      if (req instanceof Api.updates.GetDifference) {
        return new Api.updates.DifferenceTooLong({ pts: 999 });
      }
      if (req instanceof Api.updates.GetState) {
        return new Api.updates.State({
          pts: 50,
          qts: 2,
          date: 30,
          seq: 4,
          unreadCount: 0,
        });
      }
      throw new Error('unexpected');
    });

    await manager.process(new Api.UpdatesTooLong());
    expect(controls).toContain('tooLong');
    expect(await db.getCommonState()).toMatchObject({ pts: 50, qts: 2, seq: 4, date: 30 });
  });

  it('handles ChannelDifferenceTooLong on channel gap', async () => {
    const channelId = '-1000000000458';
    await db.putChannel({
      id: channelId,
      accessHash: '1',
      title: 'C',
      photo: {} as never,
      date: 1,
      min: false,
    });
    await db.setChannelPts(channelId, 1);

    const controls: string[] = [];
    manager.onControl('channelDifferenceTooLong', () => controls.push('ctl'));
    client.invoke.mockResolvedValue(
      new Api.updates.ChannelDifferenceTooLong({
        final: true,
        timeout: 1,
        dialog: new Api.Dialog({
          peer: new Api.PeerChannel({ channelId: bigInt(458) }),
          topMessage: 1,
          readInboxMaxId: 0,
          readOutboxMaxId: 0,
          unreadCount: 0,
          unreadMentionsCount: 0,
          unreadReactionsCount: 0,
          notifySettings: new Api.PeerNotifySettings({}),
          pts: 77,
        }),
        messages: [],
        chats: [],
        users: [],
      }),
    );

    await manager.process(
      new Api.UpdateNewChannelMessage({
        message: new Api.Message({
          id: 2,
          peerId: new Api.PeerChannel({ channelId: bigInt(458) }),
          message: 'gap',
          date: 1,
        }),
        pts: 20,
        ptsCount: 1,
      }),
    );

    expect(controls).toContain('ctl');
    expect(await db.getChannelPts(channelId)).toBe(77);
  }, 10_000);

  it('recovers qts gap', async () => {
    await db.setCommonState({ pts: 10, qts: 5, seq: 1, date: 100 });
    client.invoke.mockResolvedValue(
      new Api.updates.Difference({
        newMessages: [],
        newEncryptedMessages: [],
        otherUpdates: [],
        chats: [],
        users: [],
        state: new Api.updates.State({
          pts: 10,
          qts: 9,
          date: 100,
          seq: 1,
          unreadCount: 0,
        }),
      }),
    );
    await manager.process(
      new Api.UpdateNewEncryptedMessage({
        message: new Api.EncryptedMessage({
          randomId: bigInt(2),
          chatId: 1,
          date: 1,
          bytes: Buffer.alloc(0),
          file: new Api.EncryptedFileEmpty(),
        }),
        qts: 9,
      }),
    );
    expect(await db.getCommonState()).toMatchObject({ qts: 9 });
  }, 10_000);

  it('routes socket events through the pipeline', async () => {
    const seen: string[] = [];
    manager.on('UpdateUserTyping', async () => {
      seen.push('typing');
    });
    await manager.start();

    const handler = client.addEventHandler.mock.calls[0][0] as (u: Api.TypeUpdate) => void;
    handler(
      new Api.UpdateUserTyping({
        userId: bigInt(1),
        action: new Api.SendMessageTypingAction(),
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(seen).toEqual(['typing']);
  });

  it('watches and unwatches individual channels', async () => {
    const poller = (
      manager as unknown as { channelPoller: { watchedChannelIds: string[] } }
    ).channelPoller;

    manager.watchChannel('-1000000000666');
    expect(poller.watchedChannelIds).toEqual(['-1000000000666']);

    manager.unwatchChannel('-1000000000666');
    expect(poller.watchedChannelIds).toEqual([]);

    // Unwatching an unknown channel is a no-op.
    manager.unwatchChannel('-1000000000667');
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(client.invoke).not.toHaveBeenCalled();
  });

  it('onControl returns a disposer', async () => {
    const seen: string[] = [];
    const handler = () => {
      seen.push('tooLong');
    };
    const off = manager.onControl('updatesTooLong', handler);
    off();

    client.invoke.mockResolvedValue(new Api.updates.DifferenceEmpty({ date: 600, seq: 6 }));
    await manager.process(new Api.UpdatesTooLong());

    expect(seen).toEqual([]);
  });

  it('logs handler, onAny and control errors when debug is enabled', async () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const debugManager = new UpdateManager({
      transportService: createTransport(client),
      localDb: db,
      debug: true,
    });
    debugManager.on('UpdateUserTyping', async () => {
      throw new Error('handler boom');
    });
    debugManager.onAny(async () => {
      throw new Error('any boom');
    });
    debugManager.onControl('updatesTooLong', () => {
      throw new Error('control boom');
    });

    await debugManager.process(
      new Api.UpdateUserTyping({
        userId: bigInt(1),
        action: new Api.SendMessageTypingAction(),
      }),
    );
    client.invoke.mockResolvedValue(new Api.updates.DifferenceEmpty({ date: 610, seq: 7 }));
    await debugManager.process(new Api.UpdatesTooLong());

    const logged = infoSpy.mock.calls.map((call) => call[1]);
    expect(logged).toContain('handler error');
    expect(logged).toContain('onAny error');
    expect(logged).toContain('control handler error');

    debugManager.stop();
    infoSpy.mockRestore();
  });

  it('logs channel poll failures through the manager logger', async () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const channelId = '-1000000000222';
    await db.putChannel({
      id: channelId,
      accessHash: '9',
      title: 'C',
      photo: {} as never,
      date: 1,
      min: false,
    });
    const polling = new UpdateManager({
      transportService: createTransport(client),
      localDb: db,
      debug: true,
    });
    client.invoke.mockRejectedValue(new Error('offline'));

    polling.watchChannel(channelId);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(infoSpy).toHaveBeenCalledWith(
      '[UpdateManager]',
      'channel poll error',
      channelId,
      expect.any(Error),
    );

    polling.unwatchAllChannels();
    polling.stop();
    infoSpy.mockRestore();
  });

  it('postpones updates that arrive while a difference is in flight', async () => {
    let releaseDiff: () => void = () => undefined;
    const diffGate = new Promise<void>((resolve) => {
      releaseDiff = resolve;
    });
    client.invoke.mockImplementation(async (req) => {
      if (req instanceof Api.updates.GetDifference) {
        await diffGate;
        return new Api.updates.DifferenceEmpty({ date: 700, seq: 20 });
      }
      throw new Error('unexpected invoke');
    });

    const seen: number[] = [];
    manager.on('UpdateNewMessage', async (update) => {
      seen.push(update.pts);
    });

    const recovering = manager.process(new Api.UpdatePtsChanged());
    await new Promise((resolve) => setTimeout(resolve, 5));

    await manager.process(
      new Api.Updates({
        updates: [
          new Api.UpdateNewMessage({
            message: new Api.Message({
              id: 5,
              peerId: new Api.PeerUser({ userId: bigInt(1) }),
              message: 'queued',
              date: 1,
            }),
            pts: 11,
            ptsCount: 1,
          }),
        ],
        users: [],
        chats: [],
        date: 900,
        seq: 50,
      }),
    );

    expect(seen).toEqual([]);

    releaseDiff();
    await recovering;

    expect(seen).toEqual([11]);
    // The envelope's seq was dropped because it landed mid-difference.
    expect(await db.getCommonState()).toMatchObject({ pts: 11, seq: 20, date: 700 });
    expect(client.invoke).toHaveBeenCalledTimes(1);
  }, 10_000);

  it('dispatches a postponed update once a later packet fills the gap', async () => {
    const seen: number[] = [];
    manager.on('UpdateNewMessage', async (update) => {
      seen.push(update.pts);
    });
    client.invoke.mockRejectedValue(new Error('difference must not be needed'));

    const makeMsg = (id: number, pts: number, ptsCount: number) =>
      new Api.UpdateNewMessage({
        message: new Api.Message({
          id,
          peerId: new Api.PeerUser({ userId: bigInt(1) }),
          message: 'x',
          date: 1,
        }),
        pts,
        ptsCount,
      });

    const gapped = manager.process(makeMsg(1, 13, 1));
    await new Promise((resolve) => setTimeout(resolve, 10));
    // A second gap for the same sequence reuses the pending recovery timer.
    const alsoGapped = manager.process(makeMsg(3, 14, 1));
    await manager.process(makeMsg(2, 12, 2));
    await Promise.all([gapped, alsoGapped]);

    expect(seen).toEqual([12, 13, 14]);
    expect(await db.getCommonState()).toMatchObject({ pts: 14 });
    expect(client.invoke).not.toHaveBeenCalled();
  }, 10_000);

  it('skips duplicate channel pts and qts updates', async () => {
    const channelId = '-1000000000778';
    const seen: string[] = [];
    manager.on('UpdateNewChannelMessage', async () => {
      seen.push('channel');
    });
    manager.on('UpdateNewEncryptedMessage', async () => {
      seen.push('encrypted');
    });
    await db.setChannelPts(channelId, 5);
    await db.setCommonState({ pts: 10, qts: 5, seq: 1, date: 100 });

    const channelUpdate = new Api.UpdateNewChannelMessage({
      message: new Api.Message({
        id: 1,
        peerId: new Api.PeerChannel({ channelId: bigInt(778) }),
        message: 'c',
        date: 1,
      }),
      pts: 3,
      ptsCount: 1,
    });
    const encryptedUpdate = new Api.UpdateNewEncryptedMessage({
      message: new Api.EncryptedMessage({
        randomId: bigInt(1),
        chatId: 1,
        date: 1,
        bytes: Buffer.alloc(0),
        file: new Api.EncryptedFileEmpty(),
      }),
      qts: 2,
    });

    await manager.process(channelUpdate);
    await manager.process(encryptedUpdate);

    expect(seen).toEqual([]);
    expect(await db.getChannelPts(channelId)).toBe(5);
    expect(await db.getCommonState()).toMatchObject({ qts: 5 });
  });

  it('applies pts/qts carried by difference payloads without re-entering recovery', async () => {
    const channelMtpId = bigInt(555);
    const channelId = '-1000000000555';

    const commonPts: number[] = [];
    const encryptedQts: number[] = [];
    const channelPts: number[] = [];
    manager.on('UpdateNewMessage', async (update) => {
      commonPts.push(update.pts);
    });
    manager.on('UpdateNewEncryptedMessage', async (update) => {
      encryptedQts.push(update.qts);
    });
    manager.on('UpdateNewChannelMessage', async (update) => {
      channelPts.push(update.pts);
    });

    const encryptedMessage = (randomId: number) =>
      new Api.EncryptedMessage({
        randomId: bigInt(randomId),
        chatId: 1,
        date: 1,
        bytes: Buffer.alloc(0),
        file: new Api.EncryptedFileEmpty(),
      });
    const commonMsg = (pts: number) =>
      new Api.UpdateNewMessage({
        message: new Api.Message({
          id: pts,
          peerId: new Api.PeerUser({ userId: bigInt(1) }),
          message: 'x',
          date: 1,
        }),
        pts,
        ptsCount: 1,
      });
    const encryptedUpdate = (qts: number) =>
      new Api.UpdateNewEncryptedMessage({ message: encryptedMessage(qts), qts });
    const channelMsg = (pts: number, id: number) =>
      new Api.UpdateNewChannelMessage({
        message: new Api.Message({
          id,
          peerId: new Api.PeerChannel({ channelId: channelMtpId }),
          message: 'c',
          date: 1,
        }),
        pts,
        ptsCount: 1,
      });

    client.invoke.mockResolvedValue(
      new Api.updates.Difference({
        newMessages: [
          new Api.Message({
            id: 900,
            peerId: new Api.PeerUser({ userId: bigInt(2) }),
            message: 'carried',
            date: 1,
          }),
          new Api.MessageEmpty({ id: 901 }),
        ],
        newEncryptedMessages: [encryptedMessage(700)],
        otherUpdates: [
          commonMsg(11),
          commonMsg(5),
          commonMsg(50),
          encryptedUpdate(1),
          encryptedUpdate(1),
          encryptedUpdate(99),
          channelMsg(1, 11),
          channelMsg(1, 12),
          channelMsg(60, 13),
        ],
        chats: [],
        users: [],
        state: new Api.updates.State({
          pts: 100,
          qts: 100,
          date: 999,
          seq: 9,
          unreadCount: 0,
        }),
      }),
    );

    await manager.process(new Api.UpdatesTooLong());

    // pts 5 / qts 1 (repeat) / channel pts 1 (repeat) are skipped as duplicates.
    expect(commonPts).toEqual([0, 11, 50]);
    expect(encryptedQts).toEqual([0, 1, 99]);
    expect(channelPts).toEqual([1, 60]);
    expect(await db.getChannelPts(channelId)).toBe(60);
    expect(await db.getCommonState()).toMatchObject({
      pts: 100,
      qts: 100,
      seq: 9,
      date: 999,
    });
  });

  it('loops non-final channel differences and applies the final one', async () => {
    const channelId = '-1000000000333';
    await db.putChannel({
      id: channelId,
      accessHash: '77',
      title: 'C',
      photo: {} as never,
      date: 1,
      min: false,
    });
    await db.setChannelPts(channelId, 4);

    const dispatched: number[] = [];
    manager.on('UpdateNewChannelMessage', async (update) => {
      dispatched.push((update.message as { id: number }).id);
    });

    let calls = 0;
    client.invoke.mockImplementation(async (req) => {
      if (!(req instanceof Api.updates.GetChannelDifference)) {
        throw new Error('unexpected invoke');
      }
      calls += 1;
      if (calls === 1) {
        return new Api.updates.ChannelDifferenceEmpty({ final: false, pts: 6, timeout: 1 });
      }
      return new Api.updates.ChannelDifference({
        final: true,
        pts: 9,
        timeout: 5,
        newMessages: [
          new Api.Message({
            id: 31,
            peerId: new Api.PeerChannel({ channelId: bigInt(333) }),
            message: 'a',
            date: 1,
          }),
          new Api.MessageEmpty({ id: 32 }),
        ],
        otherUpdates: [],
        chats: [],
        users: [
          new Api.User({ id: bigInt(8), accessHash: bigInt(1), firstName: 'Bo' }),
        ],
      });
    });

    await manager.process(new Api.UpdateChannelTooLong({ channelId: bigInt(333), pts: 50 }));

    expect(calls).toBe(2);
    expect(dispatched).toEqual([31]);
    expect(await db.getChannelPts(channelId)).toBe(9);
    expect(await db.getUser('8')).toMatchObject({ firstName: 'Bo' });
  }, 10_000);

  it('stops short of a channel difference without a usable access hash', async () => {
    await manager.process(new Api.UpdateChannelTooLong({ channelId: bigInt(444), pts: 2 }));
    expect(client.invoke).not.toHaveBeenCalled();
  });

  it('stops short of a channel difference for a min access hash', async () => {
    await db.putChannel({
      id: '-1000000000445',
      accessHash: '3',
      title: 'C',
      photo: {} as never,
      date: 1,
      min: true,
    });
    await manager.process(new Api.UpdateChannelTooLong({ channelId: bigInt(445), pts: 2 }));
    expect(client.invoke).not.toHaveBeenCalled();
  });

  it('stops short of a channel difference when the peer id is not a channel', async () => {
    await db.putChannel({
      id: '123',
      accessHash: '3',
      title: 'C',
      photo: {} as never,
      date: 1,
      min: false,
    });
    const internals = manager as unknown as {
      fetchChannelDifference(
        channelId: string,
        options?: { untilFinal: boolean },
      ): Promise<{ final: boolean }>;
    };

    await expect(internals.fetchChannelDifference('123')).resolves.toEqual({ final: true });
    expect(client.invoke).not.toHaveBeenCalled();
  });

  it('throws when the transport has no connected client', async () => {
    const orphan = new UpdateManager({
      transportService: { client: undefined } as unknown as TransportService,
      localDb: db,
    });
    await expect(orphan.start()).rejects.toThrow('TelegramClient not connected');
  });

  it('off ignores events that were never registered', () => {
    expect(() => manager.off('UpdateChat', async () => undefined)).not.toThrow();
  });

  it('supports several handlers for the same control event', async () => {
    const seen: string[] = [];
    manager.onControl('updatesTooLong', () => {
      seen.push('a');
    });
    const offB = manager.onControl('updatesTooLong', () => {
      seen.push('b');
    });
    client.invoke.mockResolvedValue(new Api.updates.DifferenceEmpty({ date: 1, seq: 1 }));

    await manager.process(new Api.UpdatesTooLong());
    expect(seen).toEqual(['a', 'b']);

    offB();
    await manager.process(new Api.UpdatesTooLong());
    expect(seen).toEqual(['a', 'b', 'a']);
  });

  it('starts the difference from a zeroed state when nothing is stored', async () => {
    const emptyDb = createDb();
    await emptyDb.open();
    const fresh = new UpdateManager({
      transportService: createTransport(client),
      localDb: emptyDb,
    });
    client.invoke.mockResolvedValue(new Api.updates.DifferenceEmpty({ date: 42, seq: 3 }));

    await fresh.process(new Api.UpdatePtsChanged());

    expect(client.invoke.mock.calls[0][0]).toMatchObject({ pts: 0, qts: 0, date: 0 });
    expect(await emptyDb.getCommonState()).toMatchObject({ pts: 0, qts: 0, seq: 3, date: 42 });

    fresh.stop();
    await emptyDb.deleteDatabase();
  });

  it('keeps the local channel pts when ChannelDifferenceTooLong has no dialog pts', async () => {
    const channelId = '-1000000000459';
    await db.putChannel({
      id: channelId,
      accessHash: '1',
      title: 'C',
      photo: {} as never,
      date: 1,
      min: false,
    });
    await db.setChannelPts(channelId, 2);

    const dispatched: number[] = [];
    manager.on('UpdateNewChannelMessage', async (update) => {
      dispatched.push((update.message as { id: number }).id);
    });
    client.invoke.mockResolvedValue(
      new Api.updates.ChannelDifferenceTooLong({
        final: true,
        timeout: 1,
        // A folder dialog carries no channel pts.
        dialog: { className: 'DialogFolder' } as unknown as Api.TypeDialog,
        messages: [
          new Api.Message({
            id: 61,
            peerId: new Api.PeerChannel({ channelId: bigInt(459) }),
            message: 'm',
            date: 1,
          }),
        ],
        chats: [],
        users: [],
      }),
    );

    await manager.process(new Api.UpdateChannelTooLong({ channelId: bigInt(459), pts: 90 }));

    expect(dispatched).toEqual([61]);
    expect(await db.getChannelPts(channelId)).toBe(2);
  }, 10_000);

  it('returns a non-final short-poll result without looping', async () => {
    const channelId = '-1000000000460';
    await db.putChannel({
      id: channelId,
      accessHash: '4',
      title: 'C',
      photo: {} as never,
      date: 1,
      min: false,
    });
    client.invoke.mockResolvedValue(
      new Api.updates.ChannelDifferenceEmpty({ final: false, pts: 3, timeout: 2 }),
    );

    const internals = manager as unknown as {
      fetchChannelDifference(
        channelId: string,
        options?: { untilFinal: boolean },
      ): Promise<{ final: boolean; timeoutSec?: number }>;
    };

    await expect(
      internals.fetchChannelDifference(channelId, { untilFinal: false }),
    ).resolves.toEqual({ final: false, timeoutSec: 2 });
    expect(client.invoke).toHaveBeenCalledTimes(1);
    expect(await db.getChannelPts(channelId)).toBe(3);
  });

  it('requests GetChannelDifference with pts 1 when none is stored', async () => {
    const channelId = '-1000000000461';
    await db.putChannel({
      id: channelId,
      accessHash: '4',
      title: 'C',
      photo: {} as never,
      date: 1,
      min: false,
    });
    client.invoke.mockResolvedValue(
      new Api.updates.ChannelDifferenceEmpty({ final: true, pts: 8, timeout: 1 }),
    );

    const internals = manager as unknown as {
      fetchChannelDifference(
        channelId: string,
        options?: { untilFinal: boolean },
      ): Promise<{ final: boolean; timeoutSec?: number }>;
    };
    await internals.fetchChannelDifference(channelId, { untilFinal: false });

    expect(client.invoke.mock.calls[0][0]).toMatchObject({ pts: 1 });
    expect(await db.getChannelPts(channelId)).toBe(8);
  });

  it('does not throw when GetChannelDifference reports empty persistent timestamp', async () => {
    const channelId = '-1000000000462';
    await db.putChannel({
      id: channelId,
      accessHash: '4',
      title: 'C',
      photo: {} as never,
      date: 1,
      min: false,
    });
    const emptyPts = Object.assign(new Error('Persistent timestamp empty.'), {
      errorMessage: 'PERSISTENT_TIMESTAMP_EMPTY',
    });
    client.invoke.mockRejectedValue(emptyPts);

    const internals = manager as unknown as {
      fetchChannelDifference(
        channelId: string,
        options?: { untilFinal: boolean },
      ): Promise<{ final: boolean; timeoutSec?: number }>;
    };
    await expect(
      internals.fetchChannelDifference(channelId, { untilFinal: true }),
    ).resolves.toEqual({ final: true });
  });

  it('serializes concurrent work on the same sequence', async () => {
    const internals = manager as unknown as {
      withSequenceLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
    };
    const order: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = internals.withSequenceLock('common', async () => {
      await gate;
      order.push('first');
      return 'first';
    });
    const second = internals.withSequenceLock('common', async () => {
      order.push('second');
      return 'second';
    });

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(order).toEqual([]);

    release();
    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
    expect(order).toEqual(['first', 'second']);
  }, 10_000);

  it('ignores message-less and peer-less updates in the builtin id tracker', async () => {
    await manager.process({ className: 'UpdateNewMessage' } as unknown as Api.TypeUpdate);

    const message = new Api.Message({
      id: 71,
      peerId: new Api.PeerUser({ userId: bigInt(1) }),
      message: 'x',
      date: 1,
    });
    (message as { peerId?: unknown }).peerId = undefined;
    await manager.process(new Api.UpdateNewMessage({ message, pts: 11, ptsCount: 1 }));

    await manager.process(
      new Api.UpdateShortSentMessage({ id: 72, pts: 12, ptsCount: 1, date: 1 }),
    );

    expect(await db.containsMsgId('common', 71)).toBe(false);
    expect(await db.containsMsgId('common', 72)).toBe(false);
    expect(await db.getCommonState()).toMatchObject({ pts: 12 });
  });

  it('off and onAny disposer remove handlers', async () => {
    let n = 0;
    const h = async () => {
      n += 1;
    };
    manager.on('UpdateUserTyping', h);
    manager.off('UpdateUserTyping', h);
    const offAny = manager.onAny(async () => {
      n += 10;
    });
    offAny();
    await manager.process(
      new Api.UpdateUserTyping({
        userId: bigInt(1),
        action: new Api.SendMessageTypingAction(),
      }),
    );
    expect(n).toBe(0);
  });
});
