jest.mock('../../../utils/scheduler/sleep', () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
}));

import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { sleep } from '../../../utils/scheduler/sleep';
import { DialogOrderTracker } from './dialog.order-tracker';
import { DialogService } from './dialog.service';
import type { TransportService } from './transport.service';

const sleepMock = sleep as unknown as jest.Mock;

type FakeClient = {
  invoke: jest.Mock;
};

function createService(
  client: FakeClient | null,
  options: {
    debug?: boolean;
    localDb?: { resolveInputPeer: jest.Mock };
    dialogOrderTracker?: DialogOrderTracker;
    flushDialogOrder?: () => void;
  } = {},
): DialogService {
  return new DialogService({
    debug: options.debug,
    transportService: { client, debug: false } as unknown as TransportService,
    localDb: options.localDb as never,
    dialogOrderTracker: options.dialogOrderTracker,
    flushDialogOrder: options.flushDialogOrder,
  });
}

const dialog = (channelId: number, topMessage: number) =>
  new Api.Dialog({
    peer: new Api.PeerChannel({ channelId: bigInt(channelId) }),
    topMessage,
    readInboxMaxId: 0,
    readOutboxMaxId: 0,
    unreadCount: 0,
    unreadMentionsCount: 0,
    unreadReactionsCount: 0,
    notifySettings: new Api.PeerNotifySettings({} as never),
  } as never);

const message = (id: number, date: number) =>
  new Api.Message({
    id,
    peerId: new Api.PeerChannel({ channelId: bigInt(9) }),
    message: 'hi',
    date,
  } as never);

const page = (dialogs: unknown[], messages: unknown[] = []) =>
  new Api.messages.Dialogs({
    dialogs: dialogs as Api.TypeDialog[],
    messages: messages as Api.TypeMessage[],
    chats: [],
    users: [],
  });

const emptyPage = () => page([]);

async function collect(service: DialogService, folderId?: number) {
  const pages = [];
  for await (const value of service.getAllDialogs(folderId)) {
    pages.push(value);
  }
  return pages;
}

describe('DialogService.getAllDialogs', () => {
  beforeEach(() => {
    sleepMock.mockClear();
  });

  it('throws when the client is missing', async () => {
    await expect(collect(createService(null))).rejects.toThrow('Client not initialized');
  });

  it('stops immediately on DialogsNotModified', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(new Api.messages.DialogsNotModified({ count: 0 })),
    };

    await expect(collect(createService(client))).resolves.toEqual([]);
    expect(client.invoke).toHaveBeenCalledTimes(1);
  });

  it('stops immediately on an empty response', async () => {
    const client: FakeClient = { invoke: jest.fn().mockResolvedValue(undefined) };

    await expect(collect(createService(client))).resolves.toEqual([]);
  });

  it('stops when a page contains no dialogs', async () => {
    const client: FakeClient = { invoke: jest.fn().mockResolvedValue(emptyPage()) };

    await expect(collect(createService(client))).resolves.toEqual([]);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it('yields converted pages and advances the offset by the top message date', async () => {
    const client: FakeClient = {
      invoke: jest
        .fn()
        .mockResolvedValueOnce(page([dialog(9, 12)], [message(12, 1_700_000_000)]))
        .mockResolvedValue(emptyPage()),
    };

    const pages = await collect(createService(client));

    expect(pages).toHaveLength(1);
    expect(pages[0].dialogs[0]).toMatchObject({ peer: { channelId: '-1000000000009' } });
    expect(sleepMock).toHaveBeenCalledWith(300);

    const first = client.invoke.mock.calls[0][0] as Api.messages.GetDialogs;
    expect(first.offsetPeer).toBeInstanceOf(Api.InputPeerEmpty);
    expect(first.offsetDate).toBe(0);

    const second = client.invoke.mock.calls[1][0] as Api.messages.GetDialogs;
    expect(second.offsetPeer).toBeInstanceOf(Api.PeerChannel);
    expect(second.offsetDate).toBe(1_700_000_000);
  });

  it('scopes the query to a folder and stamps it on every page', async () => {
    const client: FakeClient = {
      invoke: jest
        .fn()
        .mockResolvedValueOnce(page([dialog(9, 12)], [message(12, 1_700_000_000)]))
        .mockResolvedValue(emptyPage()),
    };

    const pages = await collect(createService(client), 1);

    expect(pages).toHaveLength(1);
    expect(pages[0].folderId).toBe(1);
    const first = client.invoke.mock.calls[0][0] as Api.messages.GetDialogs;
    expect(first.folderId).toBe(1);
  });

  it('omits folderId for the main list so the default scope is used', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValueOnce(page([dialog(9, 12)], [message(12, 5)])).mockResolvedValue(emptyPage()),
    };

    const pages = await collect(createService(client));

    expect(pages[0].folderId).toBe(0);
    const first = client.invoke.mock.calls[0][0] as Api.messages.GetDialogs;
    expect(first.folderId).toBeUndefined();
  });

  it('falls back to a zero offset date when the top message is missing', async () => {
    const client: FakeClient = {
      invoke: jest
        .fn()
        .mockResolvedValueOnce(page([dialog(9, 12)], [message(99, 1_700_000_000)]))
        .mockResolvedValue(emptyPage()),
    };

    await collect(createService(client));

    const second = client.invoke.mock.calls[1][0] as Api.messages.GetDialogs;
    expect(second.offsetDate).toBe(0);
  });

  it('takes the offset peer from a folder-shaped dialog', async () => {
    const folderPeer = new Api.PeerUser({ userId: bigInt(7) });
    const client: FakeClient = {
      invoke: jest
        .fn()
        .mockResolvedValueOnce(page([{ folder: { peer: folderPeer } }]))
        .mockResolvedValue(emptyPage()),
    };

    const pages = await collect(createService(client));

    expect(pages).toHaveLength(1);
    const second = client.invoke.mock.calls[1][0] as Api.messages.GetDialogs;
    expect(second.offsetPeer).toBe(folderPeer);
    expect(second.offsetDate).toBe(0);
  });

  it('stops when the last dialog exposes neither a peer nor a folder', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(page([{ something: 'else' }])),
    };

    const pages = await collect(createService(client));

    expect(pages).toHaveLength(1);
    expect(client.invoke).toHaveBeenCalledTimes(1);
  });

  it('resets the offset date when the last dialog has no top message', async () => {
    const peer = new Api.PeerUser({ userId: bigInt(7) });
    const client: FakeClient = {
      invoke: jest
        .fn()
        .mockResolvedValueOnce(page([{ peer }]))
        .mockResolvedValue(emptyPage()),
    };

    await collect(createService(client));

    const second = client.invoke.mock.calls[1][0] as Api.messages.GetDialogs;
    expect(second.offsetPeer).toBe(peer);
    expect(second.offsetDate).toBe(0);
  });

  it('stops when the page omits the dialog list entirely', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(new Api.messages.Dialogs({} as never)),
    };

    await expect(collect(createService(client))).resolves.toEqual([]);
  });

  it('resets the offset date when the page omits the message list', async () => {
    const peer = new Api.PeerUser({ userId: bigInt(7) });
    const client: FakeClient = {
      invoke: jest
        .fn()
        .mockResolvedValueOnce(new Api.messages.Dialogs({ dialogs: [{ peer, topMessage: 12 }] } as never))
        .mockResolvedValue(emptyPage()),
    };
    const service = createService(client);
    // The page has no `messages`, which the conversion step cannot handle.
    (service as never as { conversionService: { convertDialogResponse: unknown } })
      .conversionService.convertDialogResponse = jest.fn().mockReturnValue({ dialogs: [] });

    await collect(service);

    const second = client.invoke.mock.calls[1][0] as Api.messages.GetDialogs;
    expect(second.offsetDate).toBe(0);
  });

  it('stops after 100 pages to avoid looping forever', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(page([dialog(9, 12)], [message(12, 5)])),
    };

    const pages = await collect(createService(client));

    expect(pages).toHaveLength(101);
    expect(client.invoke).toHaveBeenCalledTimes(101);
  });
});

describe('DialogService.reorderPinnedDialogs', () => {
  function seedTwoPinned(tracker: DialogOrderTracker) {
    tracker.ingestPage({
      dialogs: [
        { peer: { userId: '1' }, topMessage: 1, unreadCount: 0, pinned: true } as never,
        { peer: { userId: '2' }, topMessage: 1, unreadCount: 0, pinned: true } as never,
        { peer: { userId: '3' }, topMessage: 1, unreadCount: 0, pinned: false } as never,
      ],
      dialogFolders: [],
      messages: [
        { id: 1, date: 10, message: 'x', peer_id: { userId: '1' } } as never,
        { id: 1, date: 20, message: 'x', peer_id: { userId: '2' } } as never,
        { id: 1, date: 30, message: 'x', peer_id: { userId: '3' } } as never,
      ],
      messageServices: [],
    });
    tracker.flush();
  }

  it('throws when the client is missing', async () => {
    await expect(createService(null).reorderPinnedDialogs(['1'])).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('does not change order when a peer cannot be resolved', async () => {
    const client: FakeClient = { invoke: jest.fn() };
    const tracker = new DialogOrderTracker();
    seedTwoPinned(tracker);
    const flushDialogOrder = jest.fn();

    await expect(
      createService(client, {
        localDb: {
          resolveInputPeer: jest.fn().mockResolvedValue({ type: 'unavailable', peerId: '1' }),
        },
        dialogOrderTracker: tracker,
        flushDialogOrder,
      }).reorderPinnedDialogs(['2', '1']),
    ).rejects.toThrow('Cannot resolve InputPeer');

    expect(client.invoke).not.toHaveBeenCalled();
    expect(flushDialogOrder).not.toHaveBeenCalled();
    expect(tracker.pinnedPeerIds()).toEqual(['1', '2']);
  });

  it('applies the new pin order then invokes messages.reorderPinnedDialogs', async () => {
    const client: FakeClient = { invoke: jest.fn().mockResolvedValue(true) };
    const tracker = new DialogOrderTracker();
    seedTwoPinned(tracker);
    const flushDialogOrder = jest.fn();

    await createService(client, {
      localDb: {
        resolveInputPeer: jest.fn().mockImplementation(async (peerId: string) => ({
          type: 'user',
          userId: peerId,
          accessHash: '1',
        })),
      },
      dialogOrderTracker: tracker,
      flushDialogOrder,
    }).reorderPinnedDialogs(['2', '1']);

    expect(tracker.pinnedPeerIds()).toEqual(['2', '1']);
    expect(flushDialogOrder).toHaveBeenCalledTimes(1);
    expect(client.invoke).toHaveBeenCalledTimes(1);
    const request = client.invoke.mock.calls[0][0] as Api.messages.ReorderPinnedDialogs;
    expect(request).toBeInstanceOf(Api.messages.ReorderPinnedDialogs);
    expect(request.force).toBe(true);
    expect(request.folderId).toBe(0);
    expect(request.order).toHaveLength(2);
  });

  it('reverts the tracker when the RPC fails', async () => {
    const client: FakeClient = { invoke: jest.fn().mockRejectedValue(new Error('NETWORK')) };
    const tracker = new DialogOrderTracker();
    seedTwoPinned(tracker);
    const flushDialogOrder = jest.fn();

    await expect(
      createService(client, {
        localDb: {
          resolveInputPeer: jest.fn().mockImplementation(async (peerId: string) => ({
            type: 'user',
            userId: peerId,
            accessHash: '1',
          })),
        },
        dialogOrderTracker: tracker,
        flushDialogOrder,
      }).reorderPinnedDialogs(['2', '1']),
    ).rejects.toThrow('NETWORK');

    expect(tracker.pinnedPeerIds()).toEqual(['1', '2']);
    expect(flushDialogOrder).toHaveBeenCalledTimes(2);
  });
});

describe('DialogService logging', () => {
  it('reports the client as null without a transport service', () => {
    const service = new DialogService({
      transportService: undefined as unknown as TransportService,
    });
    expect(service.client).toBeNull();
  });

  it('prefixes debug output and stays silent otherwise', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});

    (createService(null, { debug: true }) as never as { log: (...args: unknown[]) => void }).log(
      'hello',
    );
    expect(info).toHaveBeenCalledWith('[DialogService]', 'hello');

    info.mockClear();
    (createService(null) as never as { log: (...args: unknown[]) => void }).log('hello');
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
});
