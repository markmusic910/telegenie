jest.mock('uuid', () => ({ v4: () => 'abcdef0123456789' }));

import { LocalDb } from './local-db/local-db';
import { Telegram, getTelegram } from './telegram';
import { UpdateManager } from './update-manager/update-manager';

jest.mock('./update-manager/update-manager', () => {
  return {
    UpdateManager: jest.fn().mockImplementation(() => ({
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      process: jest.fn().mockResolvedValue(undefined),
      on: jest.fn().mockReturnValue(() => {}),
      onAny: jest.fn().mockReturnValue(() => {}),
      onControl: jest.fn().mockReturnValue(() => {}),
    })),
  };
});

describe('Telegram', () => {
  it('constructs with default and custom debug', () => {
    const a = new Telegram();
    expect(a.debug).toBe(false);
    expect(a.transportService).toBeDefined();

    const b = new Telegram({ debug: true });
    expect(b.debug).toBe(true);
  });

  it('lazily creates and reuses services', () => {
    const tg = new Telegram({ debug: false });
    const auth = tg.getAuthService();
    expect(tg.getAuthService()).toBe(auth);

    const chat = tg.getChatService();
    expect(tg.getChatService()).toBe(chat);

    const channel = tg.getChannelService();
    expect(tg.getChannelService()).toBe(channel);

    const dialog = tg.getDialogService();
    expect(tg.getDialogService()).toBe(dialog);

    const message = tg.getMessageService();
    expect(tg.getMessageService()).toBe(message);
    expect(message.fileService).toBe(tg.getFileService());

    const file = tg.getFileService();
    expect(tg.getFileService()).toBe(file);

    const user = tg.getUserService();
    expect(tg.getUserService()).toBe(user);
  });

  describe('account lifecycle and subscriptions', () => {
    let tg: Telegram;
    const slot = `tg-test-${Date.now()}-${Math.random()}`;

    afterEach(async () => {
      if (tg?.localDb) {
        try {
          await tg.localDb.deleteDatabase();
        } catch {
          tg.localDb.destroy();
        }
      }
      await tg?.closeAccount();
    });

    it('openAccount creates LocalDb and UpdateManager and injects into services', async () => {
      tg = new Telegram({ debug: false });
      const user = tg.getUserService();
      expect(user.localDb).toBeUndefined();

      await tg.openAccount({ accountSlot: slot, flushDelayMs: 10_000 });

      expect(tg.localDb).toBeInstanceOf(LocalDb);
      expect(UpdateManager).toHaveBeenCalled();
      expect(user.localDb).toBe(tg.localDb);
      expect(tg.getChannelService().updateManager).toBe(tg.updateManager);
      expect(tg.getMessageService().updateManager).toBe(tg.updateManager);
    });

    it('startUpdates requires openAccount and delegates to UpdateManager', async () => {
      tg = new Telegram();
      await expect(tg.startUpdates()).rejects.toThrow('openAccount before startUpdates');

      await tg.openAccount({ accountSlot: `${slot}-start`, flushDelayMs: 10_000 });
      await tg.startUpdates();
      expect(tg.updateManager!.start).toHaveBeenCalled();

      tg.stopUpdates();
      expect(tg.updateManager!.stop).toHaveBeenCalled();
    });

    it('subscribeEntityChanges and typed filters receive LocalDb puts', async () => {
      tg = new Telegram();
      await tg.openAccount({ accountSlot: `${slot}-sub`, flushDelayMs: 10_000 });

      const all: unknown[] = [];
      const usersOnly: unknown[] = [];
      const offAll = tg.subscribeEntityChanges((c) => all.push(c));
      const offUsers = tg.onUsers((c) => usersOnly.push(c));

      await tg.localDb!.putUser({
        id: '1',
        accessHash: 'h',
        firstName: 'Ada',
        min: false,
      } as never);

      expect(all).toHaveLength(1);
      expect(usersOnly).toHaveLength(1);
      expect(usersOnly[0]).toMatchObject({ store: 'users', kind: 'put' });

      await tg.localDb!.putChat({
        id: '-10',
        title: 'G',
        participantsCount: 1,
        date: 1,
        version: 1,
      } as never);
      expect(all).toHaveLength(2);
      expect(usersOnly).toHaveLength(1);

      offAll();
      offUsers();
      await tg.localDb!.putUser({
        id: '2',
        accessHash: 'h',
        firstName: 'Bob',
        min: false,
      } as never);
      expect(all).toHaveLength(2);
    });

    it('closeAccount clears deps and resolveInputPeer returns unavailable without db', async () => {
      tg = new Telegram();
      await tg.openAccount({ accountSlot: `${slot}-close`, flushDelayMs: 10_000 });
      const user = tg.getUserService();
      await tg.closeAccount();
      expect(tg.localDb).toBeUndefined();
      expect(tg.updateManager).toBeUndefined();
      expect(user.localDb).toBeUndefined();
      await expect(tg.resolveInputPeer('1')).resolves.toEqual({
        type: 'unavailable',
        peerId: '1',
      });
    });
  });
});

describe('getTelegram', () => {
  it('returns a singleton', () => {
    const a = getTelegram();
    const b = getTelegram({ debug: true });
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(Telegram);
  });
});
