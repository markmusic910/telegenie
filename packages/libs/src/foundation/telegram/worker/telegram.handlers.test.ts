/**
 * @jest-environment node
 */
jest.mock('uuid', () => ({ v4: () => 'abcdef0123456789' }));

import { RpcError } from '../../worker-rpc';
import { SessionPasswordNeededError } from '../services/auth.service';
import { SESSION_PASSWORD_NEEDED_CODE } from './telegram.api';
import { createTelegramWorkerHandlers } from './telegram.handlers';

function mockTelegram(overrides: Record<string, unknown> = {}) {
  const auth = {
    configure: jest.fn(),
    prepareClient: jest.fn().mockResolvedValue(undefined),
    isAuthorized: jest.fn().mockResolvedValue(true),
    sendCode: jest.fn().mockResolvedValue({ phoneCodeHash: 'hash', isCodeViaApp: true }),
    signIn: jest.fn().mockResolvedValue({ id: '1', firstName: 'Ada' }),
    signInWithPassword: jest.fn().mockResolvedValue({ id: '1' }),
    getPasswordHint: jest.fn().mockResolvedValue('hint'),
    getSessionString: jest.fn().mockReturnValue('session'),
  };
  const dialog = {
    getAllDialogs: jest.fn().mockImplementation(async function* () {
      yield { dialogs: [{ id: 'd1' }], count: 1 };
      yield { dialogs: [{ id: 'd2' }], count: 1 };
    }),
    reorderPinnedDialogs: jest.fn().mockResolvedValue(undefined),
  };
  const dialogFilter = {
    getDialogFilters: jest.fn().mockResolvedValue({ filters: [], order: [0] }),
    reorderDialogFilters: jest.fn().mockResolvedValue(undefined),
  };
  const chat = {
    getChatsByIds: jest.fn().mockResolvedValue({ '-1': { id: '-1' } }),
    getFullChatByIds: jest.fn().mockResolvedValue({
      fullChats: {},
      chats: {},
      channels: {},
      users: {},
    }),
  };
  const channel = {
    getChannelsByIds: jest.fn().mockResolvedValue({}),
    getFullChannelByIds: jest.fn().mockResolvedValue({
      fullChannels: {},
      chats: {},
      channels: {},
      users: {},
    }),
  };
  const user = {
    getUsers: jest.fn().mockResolvedValue({}),
    getUsersByIds: jest.fn().mockResolvedValue({}),
    getFullUsers: jest.fn().mockResolvedValue({
      fullUsers: {},
      chats: {},
      channels: {},
      users: {},
    }),
    getFullUsersByIds: jest.fn().mockResolvedValue({
      fullUsers: {},
      chats: {},
      channels: {},
      users: {},
    }),
    resolveUsername: jest.fn().mockResolvedValue(undefined),
  };
  const message = {
    getMessages: jest.fn().mockResolvedValue([[], 0]),
    getMessagesByIds: jest.fn().mockResolvedValue({ messages: [], messageServices: [] }),
    findGapInDisplayedRange: jest.fn().mockResolvedValue(null),
    loadHistory: jest.fn().mockResolvedValue({
      messages: [],
      messageServices: [],
      users: [],
      chats: [],
      channels: [],
    }),
    markMessageListRead: jest.fn().mockResolvedValue(undefined),
    markMentionsRead: jest.fn().mockResolvedValue(undefined),
    getUnreadMentions: jest.fn().mockResolvedValue({
      messages: [],
      messageServices: [],
      users: [],
      chats: [],
      channels: [],
      emptyMessages: [],
      messageIds: [],
    }),
    readAllMentions: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue(42),
    sendMedia: jest.fn().mockResolvedValue({}),
    sendMediaWithOptions: jest.fn().mockResolvedValue({}),
    sendMultiMedia: jest.fn().mockResolvedValue([42]),
  };

  return {
    ingestDialogPage: jest.fn(),
    openAccount: jest.fn().mockResolvedValue(undefined),
    closeAccount: jest.fn().mockResolvedValue(undefined),
    startUpdates: jest.fn().mockResolvedValue(undefined),
    stopUpdates: jest.fn(),
    resolveInputPeer: jest.fn().mockResolvedValue({ type: 'user', peerId: '1' }),
    getAuthService: () => auth,
    getDialogService: () => dialog,
    getDialogFilterService: () => dialogFilter,
    getChatService: () => chat,
    getChannelService: () => channel,
    getUserService: () => user,
    getMessageService: () => message,
    ...overrides,
    _auth: auth,
    _dialog: dialog,
    _dialogFilter: dialogFilter,
    _message: message,
  } as any;
}

describe('createTelegramWorkerHandlers', () => {
  it('maps sendCode to a plain DTO', async () => {
    const tg = mockTelegram();
    const handlers = createTelegramWorkerHandlers(tg);
    await expect(handlers['auth.sendCode']('+1000')).resolves.toEqual({
      phoneCodeHash: 'hash',
      isCodeViaApp: true,
    });
  });

  it('tags SessionPasswordNeededError', async () => {
    const tg = mockTelegram();
    tg._auth.signIn.mockRejectedValue(new SessionPasswordNeededError());
    const handlers = createTelegramWorkerHandlers(tg);
    await expect(handlers['auth.signIn']('p', 'h', 'c')).rejects.toBeInstanceOf(RpcError);
    await expect(handlers['auth.signIn']('p', 'h', 'c')).rejects.toMatchObject({
      code: SESSION_PASSWORD_NEEDED_CODE,
    });
  });

  it('streams dialog batches', async () => {
    const tg = mockTelegram();
    const handlers = createTelegramWorkerHandlers(tg);
    const batches: unknown[] = [];
    for await (const batch of handlers['dialog.getAllDialogs']() as AsyncIterable<unknown>) {
      batches.push(batch);
    }
    expect(batches).toHaveLength(2);
    expect(tg.ingestDialogPage).toHaveBeenCalledTimes(2);
    expect(tg.ingestDialogPage).toHaveBeenNthCalledWith(1, batches[0], {
      reset: true,
      folderId: 0,
    });
    expect(tg.ingestDialogPage).toHaveBeenNthCalledWith(2, batches[1], {
      reset: false,
      folderId: 0,
    });
  });

  it('never resets the tracker on the archive pass', async () => {
    const tg = mockTelegram();
    const handlers = createTelegramWorkerHandlers(tg);
    const batches: unknown[] = [];
    for await (const batch of handlers['dialog.getAllDialogs'](1) as AsyncIterable<unknown>) {
      batches.push(batch);
    }
    expect(tg._dialog.getAllDialogs).toHaveBeenCalledWith(1);
    expect(tg.ingestDialogPage).toHaveBeenNthCalledWith(1, batches[0], {
      reset: false,
      folderId: 1,
    });
  });

  it('delegates the dialogFilter handlers', async () => {
    const tg = mockTelegram();
    const handlers = createTelegramWorkerHandlers(tg);

    await expect(handlers['dialogFilter.getAll']()).resolves.toEqual({
      filters: [],
      order: [0],
    });

    await handlers['dialogFilter.reorder']([0, 3, 2]);
    expect(tg._dialogFilter.reorderDialogFilters).toHaveBeenCalledWith([0, 3, 2]);
  });

  it('delegates dialog.reorderPinned', async () => {
    const tg = mockTelegram();
    const handlers = createTelegramWorkerHandlers(tg);
    await handlers['dialog.reorderPinned'](['2', '1'], 0);
    expect(tg._dialog.reorderPinnedDialogs).toHaveBeenCalledWith(['2', '1'], 0);
  });

  it('delegates account.open', async () => {
    const tg = mockTelegram();
    const handlers = createTelegramWorkerHandlers(tg);
    await handlers['account.open']({ accountSlot: 'default' });
    expect(tg.openAccount).toHaveBeenCalledWith({ accountSlot: 'default' });
  });

  it('delegates message.findGapInDisplayedRange', async () => {
    const tg = mockTelegram();
    const handlers = createTelegramWorkerHandlers(tg);
    await expect(handlers['message.findGapInDisplayedRange']('7', 1, 10)).resolves.toBeNull();
    expect(tg._message.findGapInDisplayedRange).toHaveBeenCalledWith('7', 1, 10);
  });

  it('delegates debug.deleteLocalEntity', async () => {
    const debugDeleteLocalEntity = jest.fn().mockResolvedValue(undefined);
    const tg = mockTelegram({ debugDeleteLocalEntity });
    const handlers = createTelegramWorkerHandlers(tg);
    await handlers['debug.deleteLocalEntity']('chats', '-10');
    expect(debugDeleteLocalEntity).toHaveBeenCalledWith('chats', '-10');
  });

  it('delegates file.downloadPeerPhotos', async () => {
    const downloadPeerPhotos = jest.fn().mockResolvedValue([]);
    const tg = mockTelegram({
      getFileService: () => ({ downloadPeerPhotos }),
    });
    const handlers = createTelegramWorkerHandlers(tg);
    const items = [{ peerId: '1', photoId: '2', dcId: 2 }];
    await handlers['file.downloadPeerPhotos'](items);
    expect(downloadPeerPhotos).toHaveBeenCalledWith(items);
  });
});
