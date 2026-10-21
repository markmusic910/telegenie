import { StoreCache, type CachedMessageRow } from './store.cache';
import EntityStore from '../entity/entity.store';
import { CustomEmojiDocument } from '../entity/models/custom-emoji.model';
import { Dialog } from '../entity/models/dialog.model';
import { Message } from '../entity/models/message.model';
import { EntityDataProvider } from '../entity/entity.data-provider';
import GlobalStore from '../global/global.store';
import {
  MODEL_TYPE,
  type CustomEmojiDocumentEntity,
  type DialogEntity,
  type MessageEntity,
} from '../types';

describe('StoreCache', () => {
  it('round-trips dialog, message, and global snapshots', async () => {
    const slot = `sdk-cache-${Date.now()}`;
    const cache = new StoreCache({ accountSlot: slot, flushDelayMs: 10 });
    await cache.open();

    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const globalStore = new GlobalStore();

    cache.attachDialogStore(dialogStore);
    cache.attachMessageStore('peer-1', messageStore);
    cache.attachGlobalStore(globalStore);
    cache.setPersistEnabled(true);

    dialogStore.update([
      {
        id: 'peer-1',
        peerId: 'peer-1',
        unreadCount: 2,
        topMessageId: '9',
        isFolder: false,
      },
    ]);
    messageStore.update([
      {
        kind: 'message',
        id: '9',
        peerId: 'peer-1',
        peerType: 'user',
        message: 'hello',
        date: 100,
        out: false,
        fromId: 'peer-1',
        fromType: 'user',
        post: false,
        isEmpty: false,
      },
    ]);
    globalStore.nav.setSelectedDialogId('peer-1');
    globalStore.nav.setSortedDialogIds(['peer-1']);
    globalStore.getOrCreateThreadUI('peer-1').ingestHistorySlice([9]);

    await new Promise((r) => setTimeout(r, 80));
    await cache.flush();
    cache.close();

    const restored = new StoreCache({ accountSlot: slot, flushDelayMs: 10 });
    await restored.open();
    const dialogs = await restored.loadDialogs();
    const messages = await restored.loadMessages();
    const global = await restored.loadGlobal();

    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].id).toBe('peer-1');
    expect(messages).toHaveLength(1);
    expect(messages[0].cacheKey).toBe('peer-1:9');
    expect(messages[0].message).toBe('hello');
    expect(global?.app).toMatchObject({
      selectedDialogId: 'peer-1',
      sortedDialogIds: ['peer-1'],
    });
    const thread = (global?.app as { dialogs?: Record<string, { threads?: Record<string, { msgIndexes?: { cachedIds?: number[] } }> }> })
      ?.dialogs?.['peer-1']?.threads?.['-1'];
    expect(thread?.msgIndexes?.cachedIds).toEqual([9]);

    restored.close();
  });

  it('loadMessagesByIds returns only the requested peer rows', async () => {
    const slot = `sdk-cache-by-ids-${Date.now()}`;
    const cache = new StoreCache({ accountSlot: slot, flushDelayMs: 10 });
    await cache.open();
    cache.setPersistEnabled(true);

    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    cache.attachMessageStore('peer-1', messageStore);
    messageStore.update([
      {
        kind: 'message',
        id: '9',
        peerId: 'peer-1',
        peerType: 'user',
        message: 'hello',
        date: 100,
        out: false,
        fromId: 'peer-1',
        fromType: 'user',
        post: false,
        isEmpty: false,
      },
      {
        kind: 'message',
        id: '10',
        peerId: 'peer-1',
        peerType: 'user',
        message: 'later',
        date: 101,
        out: false,
        fromId: 'peer-1',
        fromType: 'user',
        post: false,
        isEmpty: false,
      },
    ]);
    await cache.flush();

    const hits = await cache.loadMessagesByIds('peer-1', ['9', '11']);
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe('9');
    expect(hits[0].message).toBe('hello');
    expect((hits[0] as CachedMessageRow).cacheKey).toBeUndefined();

    const otherPeer = await cache.loadMessagesByIds('peer-2', ['9']);
    expect(otherPeer).toHaveLength(0);

    cache.close();
  });

  it('does not write while persist is disabled and flushes on promote', async () => {
    const slot = `sdk-cache-follower-${Date.now()}`;
    const cache = new StoreCache({ accountSlot: slot, flushDelayMs: 10 });
    await cache.open();

    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    cache.attachDialogStore(dialogStore);

    dialogStore.update([
      {
        id: 'peer-1',
        peerId: 'peer-1',
        unreadCount: 1,
        topMessageId: '1',
        isFolder: false,
      },
    ]);
    await cache.flush();
    expect(await cache.loadDialogs()).toHaveLength(0);

    cache.setPersistEnabled(true);
    await cache.persistSnapshot();
    const rows = await cache.loadDialogs();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('peer-1');
    cache.close();
  });

  it('forceDelete and forceClear write even when persist is disabled', async () => {
    const slot = `sdk-cache-force-${Date.now()}`;
    const cache = new StoreCache({ accountSlot: slot, flushDelayMs: 10 });
    await cache.open();
    cache.setPersistEnabled(true);

    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    cache.attachDialogStore(dialogStore);
    cache.attachMessageStore('peer-1', messageStore);

    dialogStore.update([
      {
        id: 'peer-1',
        peerId: 'peer-1',
        unreadCount: 1,
        topMessageId: '9',
        isFolder: false,
      },
      {
        id: 'peer-2',
        peerId: 'peer-2',
        unreadCount: 0,
        topMessageId: '1',
        isFolder: false,
      },
    ]);
    messageStore.update([
      {
        kind: 'message',
        id: '9',
        peerId: 'peer-1',
        peerType: 'user',
        message: 'hello',
        date: 100,
        out: false,
        fromId: 'peer-1',
        fromType: 'user',
        post: false,
        isEmpty: false,
      },
    ]);
    await cache.flush();
    cache.setPersistEnabled(false);

    await cache.forceDelete('dialog', 'peer-1');
    expect((await cache.loadDialogs()).map((row) => row.id).sort()).toEqual(['peer-2']);

    await cache.forceDeleteMessagesByPeer('peer-1');
    expect(await cache.loadMessages()).toHaveLength(0);

    await cache.forceClear('dialog');
    expect(await cache.loadDialogs()).toHaveLength(0);

    cache.close();
  });

  it('forceClearAll empties every SDK cache object store', async () => {
    const slot = `sdk-cache-force-all-${Date.now()}`;
    const cache = new StoreCache({ accountSlot: slot, flushDelayMs: 10 });
    await cache.open();
    cache.setPersistEnabled(true);

    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const globalStore = new GlobalStore();
    cache.attachDialogStore(dialogStore);
    cache.attachMessageStore('peer-1', messageStore);
    cache.attachGlobalStore(globalStore);

    dialogStore.update([
      {
        id: 'peer-1',
        peerId: 'peer-1',
        unreadCount: 1,
        topMessageId: '9',
        isFolder: false,
      },
    ]);
    messageStore.update([
      {
        kind: 'message',
        id: '9',
        peerId: 'peer-1',
        peerType: 'user',
        message: 'hello',
        date: 100,
        out: false,
        fromId: 'peer-1',
        fromType: 'user',
        post: false,
        isEmpty: false,
      },
    ]);
    globalStore.nav.setSelectedDialogId('peer-1');
    await new Promise((r) => setTimeout(r, 80));
    await cache.flush();

    expect(await cache.loadDialogs()).toHaveLength(1);
    expect(await cache.loadMessages()).toHaveLength(1);
    expect(await cache.loadGlobal()).toBeDefined();

    await cache.forceClearAll();
    expect(await cache.loadDialogs()).toHaveLength(0);
    expect(await cache.loadMessages()).toHaveLength(0);
    expect(await cache.loadGlobal()).toBeUndefined();

    cache.close();
  });

  it('forcePersistGlobal writes while persist is disabled', async () => {
    const slot = `sdk-cache-force-global-${Date.now()}`;
    const cache = new StoreCache({ accountSlot: slot, flushDelayMs: 10 });
    await cache.open();
    const globalStore = new GlobalStore();
    cache.attachGlobalStore(globalStore);
    globalStore.nav.setSelectedDialogId('peer-9');
    globalStore.getOrCreateThreadUI('peer-9');

    await cache.forcePersistGlobal(globalStore.toJS());
    const global = await cache.loadGlobal();
    expect(global?.app).toMatchObject({
      selectedDialogId: 'peer-9',
    });
    expect(
      (global?.app as { dialogs?: Record<string, unknown> }).dialogs?.['peer-9'],
    ).toBeDefined();
    cache.close();
  });

  it('round-trips custom emoji documents when persist is enabled', async () => {
    const slot = `sdk-cache-emoji-${Date.now()}`;
    const cache = new StoreCache({ accountSlot: slot, flushDelayMs: 10 });
    await cache.open();
    cache.setPersistEnabled(true);
    const store = new EntityStore<CustomEmojiDocument, CustomEmojiDocumentEntity>({
      model: CustomEmojiDocument,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    cache.attachCustomEmojiStore(store);
    store.update([
      {
        id: '42',
        accessHash: '7',
        fileReference: '',
        date: 3,
        mimeType: 'application/x-tgsticker',
        size: '9',
        dcId: 2,
        attributes: [],
      },
    ]);
    await cache.flush();
    cache.close();

    const restored = new StoreCache({ accountSlot: slot, flushDelayMs: 10 });
    await restored.open();
    const rows = await restored.loadCustomEmojiByIds(['42', 'missing']);
    expect(rows).toEqual([
      expect.objectContaining({ id: '42', mimeType: 'application/x-tgsticker' }),
    ]);
    restored.close();
  });
});
