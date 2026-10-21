import { GET_HISTORY_LIMIT } from '@telegenie/libs/foundation/telegram/worker/telegram.api';
import { GlobalStore } from '../../store';
import { EntityDataProvider } from '../../store/entity/entity.data-provider';
import EntityStore from '../../store/entity/entity.store';
import { Channel } from '../../store/entity/models/channel.model';
import { Dialog } from '../../store/entity/models/dialog.model';
import { Message } from '../../store/entity/models/message.model';
import { User } from '../../store/entity/models/user.model';
import StoreManager from '../../store/store.manager';
import type {
  ChannelEntity,
  DialogEntity,
  Entity,
  EntityWithId,
  MessageEntity,
  UserEntity,
} from '../../store/types';
import { MODEL_TYPE } from '../../store/types';
import { MessageDraftController, SAVE_DRAFT_DEBOUNCE_MS } from './message-draft.controller';
import { MessageLoadController } from './message-load.controller';
import { MessageReadController } from './message-read.controller';
import { MessageSendController } from './message-send.controller';

function createControllers(
  sm: StoreManager,
  call: jest.Mock,
  globalStore = new GlobalStore(sm),
  resolveUsername?: (username: string) => Promise<string | undefined>,
  loadCachedMessages?: (peerId: string, ids: string[]) => Promise<MessageEntity[]>,
  loadUnreadReactionsOnOpen?: (peerId: string) => Promise<void>,
) {
  const worker = { call } as never;
  const ensureMessageStore = (peerId: string) => sm.get(`${peerId}-message`) as never;
  const draft = new MessageDraftController({ worker, sm, globalStore });
  const load = new MessageLoadController({
    sm,
    globalStore,
    worker,
    ensureMessageStore,
    resolveUsername,
    loadCachedMessages,
    loadUnreadReactionsOnOpen,
    flushPendingInboxRead: (peerId) => read.flushPendingInboxRead(peerId),
    adoptDialogDraft: (peerId, threadId) => draft.adoptDialogDraft(peerId, threadId),
  });
  const read = new MessageReadController({
    sm,
    globalStore,
    worker,
    ensureMessageStore,
    focusMessage: (peerId, opts) => load.focusMessage(peerId, opts),
    ingestUnreadMentionHistory: (peerId, result) => load.ingestUnreadMentionHistory(peerId, result),
  });
  const send = new MessageSendController({
    worker,
    sm,
    globalStore,
    drafts: draft,
    jumpToBottom: (peerId, threadId) => load.jumpToBottom(peerId, threadId),
  });
  return { load, read, send, draft };
}

function createMessageEntity(id: string, peerId: string, out = false): MessageEntity {
  return {
    id,
    peerId,
    date: 1_700_000_000 + Number(id),
    out,
    kind: 'message',
  } as MessageEntity;
}

function createDialog(overrides: Partial<DialogEntity> = {}): Dialog {
  return new Dialog({
    id: '7',
    peerId: '7',
    topMessageId: '10',
    unreadCount: 3,
    readInboxMaxId: 5,
    ...overrides,
  } as DialogEntity);
}

describe('MessageLoadController.loadHistory', () => {
  it('merges fetched messages into the peer message store', async () => {
    const call = jest.fn().mockResolvedValue({
      messages: [{ id: 8, peerId: '7', date: 1, message: 'hi', out: false }],
      messageServices: [],
      users: [],
      chats: [],
      channels: [],
      count: 100,
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ topMessageId: '5' })]);
    sm.set('dialog', dialogStore);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.selectDialog('7');

    expect(call).toHaveBeenCalledWith('message.loadHistory', [
      '7',
      { direction: 'around', offsetId: 5, limit: GET_HISTORY_LIMIT },
    ]);
    expect(messageStore.get('8')).toBeDefined();
  });

  it('stamps replyTargetVerified before writing history to the store', async () => {
    const call = jest.fn().mockResolvedValue({
      messages: [
        { id: 1, date: 1, message: 'original', out: false, peer_id: { userId: '7' } },
        {
          id: 2,
          date: 2,
          message: 'reply',
          out: false,
          peer_id: { userId: '7' },
          reply_to: { replyToMsgId: 1 },
        },
      ],
      messageServices: [],
      users: [],
      chats: [],
      channels: [],
      count: 2,
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ unreadCount: 0 })]);
    sm.set('dialog', dialogStore);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.selectDialog('7');

    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith('message.loadHistory', [
      '7',
      { direction: 'around', offsetId: 10, limit: GET_HISTORY_LIMIT },
    ]);
    expect(messageStore.getAllData().get('2')?.replyTargetVerified).toBe(true);
  });

  it('fetches a missing reply target before writing the parent message', async () => {
    const call = jest.fn().mockImplementation(async (method: string) => {
      if (method === 'message.loadHistory') {
        return {
          messages: [
            {
              id: 2,
              date: 2,
              message: 'reply',
              out: false,
              peer_id: { userId: '7' },
              reply_to: { replyToMsgId: 40 },
            },
          ],
          messageServices: [],
          users: [],
          chats: [],
          channels: [],
        };
      }
      if (method === 'message.getMessagesByIds') {
        return {
          messages: [
            { id: 40, date: 1, message: 'original', out: false, peer_id: { userId: '7' } },
          ],
          messageServices: [],
        };
      }
      throw new Error(`unexpected ${method}`);
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ unreadCount: 0 })]);
    sm.set('dialog', dialogStore);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.selectDialog('7');

    expect(call).toHaveBeenCalledWith('message.getMessagesByIds', ['7', [40]]);
    expect(messageStore.getAllData().get('40')?.message).toBe('original');
    expect(messageStore.getAllData().get('2')?.replyTargetVerified).toBe(true);
  });

  it('merges service messages into the peer message store', async () => {
    const call = jest.fn().mockResolvedValue({
      messages: [],
      messageServices: [
        {
          id: 9,
          peer_id: { chatId: '7' },
          from_id: { userId: '42' },
          date: 1,
          action: { inviterId: '99' },
        },
      ],
      users: [{ id: 42, firstName: 'Daniel', lastName: 'Mike' }],
      chats: [],
      channels: [],
      count: 10,
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ unreadCount: 0 })]);
    sm.set('dialog', dialogStore);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    const userStore = new EntityStore<User, UserEntity>({
      model: User,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('user', userStore);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.selectDialog('7');

    expect(messageStore.get('9')).toBeDefined();
    expect(messageStore.get('9')?.kind).toBe('service');
    expect(userStore.get('42')?.firstName).toBe('Daniel');
  });
});

describe('MessageLoadController.focusMessage', () => {
  it('skips loadHistory when the message is already in the store', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([createMessageEntity('42', '7', false)]);
    sm.set('7-message', messageStore);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    globalStore.nav.setSelectedDialogId('7');
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['42']);

    await controller.focusMessage('7', { messageId: '42' });

    expect(call).not.toHaveBeenCalled();
    expect(globalStore.getThreadUI('7', '-1')?.focusedMessageId).toBe('42');
    expect(globalStore.getThreadUI('7', '-1')?.focusPending).toBe(false);
  });

  it('loads history around the target when the message is missing', async () => {
    const call = jest.fn().mockResolvedValue({
      messages: [{ id: 42, date: 1, message: 'old', out: false, peer_id: { userId: '7' } }],
      messageServices: [],
      users: [],
      chats: [],
      channels: [],
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.focusMessage('7', { messageId: '42' });

    expect(call).toHaveBeenCalledWith('message.loadHistory', [
      '7',
      { direction: 'around', offsetId: 42, limit: GET_HISTORY_LIMIT },
    ]);
    expect(messageStore.get('42')).toBeDefined();
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['42']);
  });

  it('replaces the listed window instead of merging cache islands', async () => {
    const call = jest.fn().mockResolvedValue({
      messages: [
        { id: 40, date: 1, message: 'old-a', out: false, peer_id: { userId: '7' } },
        { id: 42, date: 2, message: 'old-b', out: false, peer_id: { userId: '7' } },
      ],
      messageServices: [],
      users: [],
      chats: [],
      channels: [],
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([createMessageEntity('990', '7'), createMessageEntity('1000', '7')]);
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['990', '1000']);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.focusMessage('7', { messageId: '42' });

    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['40', '42']);
    const listed = new Set(
      globalStore
        .getOrCreateThreadUI('7')
        .getMessageList()
        .flatMap((item) => {
          if (item.kind === 'message' || item.kind === 'action' || item.kind === 'album') {
            return [item.message.id];
          }
          return [];
        }),
    );
    expect(listed.has('42')).toBe(true);
    expect(listed.has('990')).toBe(false);
  });

  it('pushes reply stack when jumping from a reply in the same chat', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([
      createMessageEntity('10', '7', false),
      createMessageEntity('20', '7', false),
    ]);
    sm.set('7-message', messageStore);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    globalStore.nav.setSelectedDialogId('7');
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['10', '20']);

    await controller.focusMessage('7', {
      messageId: '10',
      replyFromMessageId: '20',
    });

    expect(globalStore.getThreadUI('7', '-1')?.replyStack).toEqual(['20']);
  });

  it('jumpToBottom leaves listedIds unchanged when already on the newest window', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    sm.set(
      '7-message',
      new EntityStore<Message, MessageEntity>({
        model: Message,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );
    sm.set(
      'dialog',
      new EntityStore<Dialog, DialogEntity>({
        model: Dialog,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );
    sm.get('dialog').update([createDialog({ topMessageId: '10' })]);
    sm.get('7-message').update([createMessageEntity('9', '7'), createMessageEntity('10', '7')]);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([9, 10]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['9', '10']);
    globalStore.getOrCreateThreadUI('7', '-1').setPinToBottom(false);
    globalStore.getOrCreateThreadUI('7', '-1').setPendingNewerCount(3);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.jumpToBottom('7');

    expect(call).not.toHaveBeenCalled();
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['9', '10']);
    expect(globalStore.getThreadUI('7', '-1')?.pinToBottom).toBe(true);
    expect(globalStore.getThreadUI('7', '-1')?.pendingNewerCount).toBe(0);
  });

  it('jumpToBottom restores the newest window from cache without fetching', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const ids = Array.from({ length: 100 }, (_, i) => i + 1);
    messageStore.update(ids.map((id) => createMessageEntity(String(id), '7')));
    sm.set('7-message', messageStore);
    sm.set(
      'dialog',
      new EntityStore<Dialog, DialogEntity>({
        model: Dialog,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );
    sm.get('dialog').update([createDialog({ topMessageId: '100' })]);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice(ids);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['1', '2']);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.jumpToBottom('7');

    expect(call).not.toHaveBeenCalled();
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toHaveLength(GET_HISTORY_LIMIT);
    expect(globalStore.getThreadUI('7', '-1')?.listedIds.at(-1)).toBe('100');
    expect(globalStore.getThreadUI('7', '-1')?.listedFollowsNewest).toBe(true);
    expect(globalStore.getThreadUI('7', '-1')?.pinToBottom).toBe(true);
  });

  it('jumpToBottom loads the newest page ending at topMessageId when cache is short', async () => {
    const call = jest.fn().mockResolvedValue({
      messages: [
        { id: 990, date: 9, message: 'late-a', out: false, peer_id: { userId: '7' } },
        { id: 1000, date: 10, message: 'late-b', out: false, peer_id: { userId: '7' } },
      ],
      messageServices: [],
      users: [],
      chats: [],
      channels: [],
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([createMessageEntity('40', '7'), createMessageEntity('42', '7')]);
    sm.set('7-message', messageStore);
    sm.set(
      'dialog',
      new EntityStore<Dialog, DialogEntity>({
        model: Dialog,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );
    sm.get('dialog').update([createDialog({ topMessageId: '1000' })]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['40', '42']);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.jumpToBottom('7');

    expect(call).toHaveBeenCalledWith('message.loadHistory', [
      '7',
      { direction: 'backwards', offsetId: 1000, limit: GET_HISTORY_LIMIT },
    ]);
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['990', '1000']);
    expect(globalStore.getThreadUI('7', '-1')?.hasMoreNewer).toBe(false);
    expect(globalStore.getThreadUI('7', '-1')?.listedFollowsNewest).toBe(true);
    expect(globalStore.getThreadUI('7', '-1')?.pinToBottom).toBe(true);
  });

  it('fillDisplayedGap fills unresolved channel holes via getMessages', async () => {
    const channelId = '-1000000000123';
    const call = jest.fn((method: string) => {
      if (method === 'message.getMessagesByIds') {
        return Promise.resolve({
          messages: [
            { id: 8, date: 1, message: 'older', out: false, peer_id: { userId: channelId } },
            { id: 9, date: 2, message: 'older-b', out: false, peer_id: { userId: channelId } },
          ],
          messageServices: [],
          emptyMessages: [{ id: 7 }],
        });
      }
      return Promise.resolve(undefined);
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([
      createMessageEntity('10', channelId),
      createMessageEntity('11', channelId),
    ]);
    sm.set(`${channelId}-message`, messageStore);
    globalStore.getOrCreateThreadUI(channelId).ingestChannelSpan({
      min: 10,
      max: 11,
      cachedIds: [10, 11],
    });
    globalStore.getOrCreateThreadUI(channelId).replaceListedWindow(['10', '11']);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    const result = await controller.fillDisplayedGap(channelId, 1, 9);

    expect(call).toHaveBeenCalledWith('message.getMessagesByIds', [
      channelId,
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
    ]);
    expect(result.gap).toEqual([1, 9]);
    expect(globalStore.getThreadUI(channelId, '-1')?.listedIds).toEqual(['8', '9', '10', '11']);
    expect(globalStore.getThreadUI(channelId, '-1')?.listedIds).not.toContain('7');
    expect(globalStore.getThreadUI(channelId, '-1')?.msgIndexes.deletedIds).toEqual(
      expect.arrayContaining([1, 2, 3, 4, 5, 6, 7]),
    );
    expect(messageStore.getAllData().get('7')?.isEmpty).toBe(true);
  });

  it('slideListedWindow uses getHistory for private chats', async () => {
    const call = jest.fn((method: string) => {
      if (method === 'message.loadHistory') {
        return Promise.resolve({
          messages: [
            { id: 8, date: 1, message: 'older', out: false, peer_id: { userId: '7' } },
            { id: 9, date: 2, message: 'older-b', out: false, peer_id: { userId: '7' } },
          ],
          messageServices: [],
          users: [],
          chats: [],
          channels: [],
        });
      }
      return Promise.resolve(undefined);
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([createMessageEntity('10', '7'), createMessageEntity('11', '7')]);
    sm.set('7-message', messageStore);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ unreadCount: 3, readInboxMaxId: 9 })]);
    sm.set('dialog', dialogStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([10, 11]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['10', '11']);
    globalStore.getOrCreateThreadUI('7').freezeUnreadDivider();
    expect(globalStore.getThreadUI('7', '-1')?.unreadDividerId).toBe('10');

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.slideListedWindow('7', 'older');

    expect(call).toHaveBeenCalledWith('message.loadHistory', [
      '7',
      { direction: 'backwards', offsetId: 10, limit: GET_HISTORY_LIMIT },
    ]);
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['8', '9', '10', '11']);
    expect(globalStore.getThreadUI('7', '-1')?.isLoadingHistory).toBe(false);
    expect(globalStore.getThreadUI('7', '-1')?.unreadDividerId).toBe('10');
    expect(call).not.toHaveBeenCalledWith('message.getMessagesByIds', expect.anything());
  });

  it('slideListedWindow skips work while a history load is already in flight', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['10', '11']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ isLoadingHistory: true });

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.slideListedWindow('7', 'older');

    expect(call).not.toHaveBeenCalled();
    expect(globalStore.getThreadUI('7', '-1')?.isLoadingHistory).toBe(true);
  });

  it('slideListedWindow slides a full older cache run without fetching', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const ids = Array.from({ length: GET_HISTORY_LIMIT + 1 }, (_, i) => i + 1);
    const newest = String(ids[ids.length - 1]);
    dialogStore.update([createDialog({ unreadCount: 0, topMessageId: newest })]);
    sm.set('dialog', dialogStore);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update(ids.map((id) => createMessageEntity(String(id), '7')));
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice(ids);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow([newest]);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.slideListedWindow('7', 'older');

    expect(call).not.toHaveBeenCalled();
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(ids.map(String));
    expect(globalStore.getThreadUI('7', '-1')?.isLoadingHistory).toBe(false);
  });

  it('slideListedWindow slides a full newer cache run without fetching', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ unreadCount: 0, topMessageId: '101' })]);
    sm.set('dialog', dialogStore);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const ids = Array.from({ length: GET_HISTORY_LIMIT + 1 }, (_, i) => i + 1);
    messageStore.update(ids.map((id) => createMessageEntity(String(id), '7')));
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice(ids);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['1']);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.slideListedWindow('7', 'newer');

    expect(call).not.toHaveBeenCalled();
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(ids.map(String));
    expect(globalStore.getThreadUI('7', '-1')?.isLoadingHistory).toBe(false);
  });

  it('slideListedWindow with preload does not call loadHistory when the next page is already cached', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const ids = Array.from({ length: GET_HISTORY_LIMIT * 2 + 1 }, (_, i) => i + 1);
    const newest = String(ids[ids.length - 1]);
    dialogStore.update([createDialog({ unreadCount: 0, topMessageId: newest })]);
    sm.set('dialog', dialogStore);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update(ids.map((id) => createMessageEntity(String(id), '7')));
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice(ids);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow([newest]);

    const { load: controller } = createControllers(sm, call, globalStore);
    await controller.slideListedWindow('7', 'older', undefined, { preload: true });

    await new Promise((r) => setTimeout(r, 10));

    expect(call).not.toHaveBeenCalled();
  });

  it('slideListedWindow with preload hydrates cached messages from IDB cache without remote fetch', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const ids = Array.from({ length: GET_HISTORY_LIMIT * 2 + 1 }, (_, i) => i + 1);
    const newest = String(ids[ids.length - 1]);
    dialogStore.update([createDialog({ unreadCount: 0, topMessageId: newest })]);
    sm.set('dialog', dialogStore);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const firstPageIds = ids.slice(GET_HISTORY_LIMIT);
    messageStore.update(firstPageIds.map((id) => createMessageEntity(String(id), '7')));
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice(ids);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow([newest]);

    const loadCachedMessages = jest.fn(async (_peerId: string, requestedIds: string[]) => {
      return requestedIds.map((id) => createMessageEntity(id, '7'));
    });

    const { load: controller } = createControllers(sm, call, globalStore, undefined, loadCachedMessages);
    await controller.slideListedWindow('7', 'older', undefined, { preload: true });

    await new Promise((r) => setTimeout(r, 10));

    expect(call).not.toHaveBeenCalled();
    expect(loadCachedMessages).toHaveBeenCalled();
  });

  it('slideListedWindow with preload fetches from the edge of cached run when cache is partial', async () => {
    const call = jest.fn((method: string) => {
      if (method === 'message.loadHistory') {
        return Promise.resolve({ messages: [] });
      }
      return Promise.resolve();
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const ids = Array.from({ length: GET_HISTORY_LIMIT + 11 }, (_, i) => i + 10);
    const newest = String(ids[ids.length - 1]);
    dialogStore.update([createDialog({ unreadCount: 0, topMessageId: newest })]);
    sm.set('dialog', dialogStore);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update(ids.map((id) => createMessageEntity(String(id), '7')));
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice(ids);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ oldestMessageId: '1', hasMoreHistory: true });
    globalStore.getOrCreateThreadUI('7').replaceListedWindow([newest]);

    const { load: controller } = createControllers(sm, call, globalStore);
    await controller.slideListedWindow('7', 'older', undefined, { preload: true });

    await new Promise((r) => setTimeout(r, 10));

    expect(call).toHaveBeenCalledWith('message.loadHistory', [
      '7',
      expect.objectContaining({ offsetId: 10 }),
    ]);
  });

  it('slideListedWindow fetches history at a private island break', async () => {
    const call = jest.fn((method: string) => {
      if (method === 'message.loadHistory') {
        return Promise.resolve({
          messages: [
            { id: 70, date: 1, message: 'older', out: false, peer_id: { userId: '7' } },
            { id: 71, date: 2, message: 'older-b', out: false, peer_id: { userId: '7' } },
          ],
          messageServices: [],
          users: [],
          chats: [],
          channels: [],
        });
      }
      return Promise.resolve(undefined);
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([
      createMessageEntity('10', '7'),
      createMessageEntity('12', '7'),
      createMessageEntity('14', '7'),
      createMessageEntity('79', '7'),
      createMessageEntity('80', '7'),
    ]);
    sm.set('7-message', messageStore);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ unreadCount: 0, topMessageId: '80' })]);
    sm.set('dialog', dialogStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([10, 12, 14]);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([79, 80]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['79', '80']);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.slideListedWindow('7', 'older');

    expect(call).toHaveBeenCalledWith('message.loadHistory', [
      '7',
      { direction: 'backwards', offsetId: 79, limit: GET_HISTORY_LIMIT },
    ]);
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['70', '71', '79', '80']);
  });

  it('slideListedWindow skips newer while listedFollowsNewest', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ unreadCount: 0, topMessageId: '100' })]);
    sm.set('dialog', dialogStore);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['99', '100']);
    dialogStore.update([createDialog({ unreadCount: 0, topMessageId: '101' })]);

    expect(globalStore.getThreadUI('7', '-1')?.listedFollowsNewest).toBe(true);
    expect(globalStore.getThreadUI('7', '-1')?.hasMoreNewer).toBe(true);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.slideListedWindow('7', 'newer');

    expect(call).not.toHaveBeenCalled();
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['99', '100']);
    expect(globalStore.getThreadUI('7', '-1')?.isLoadingHistory).toBe(false);
  });

  it('slideListedWindow skips older when already at the oldest cached message', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([10, 11]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['10', '11']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ hasMoreHistory: false });

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.slideListedWindow('7', 'older');

    expect(call).not.toHaveBeenCalled();
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['10', '11']);
    expect(globalStore.getThreadUI('7', '-1')?.isLoadingHistory).toBe(false);
  });

  it('slideListedWindow slides older cache when hasMoreHistory is false but listed is not at the oldest', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const ids = Array.from({ length: GET_HISTORY_LIMIT + 1 }, (_, i) => i + 1);
    const newest = String(ids[ids.length - 1]);
    dialogStore.update([createDialog({ unreadCount: 0, topMessageId: newest })]);
    sm.set('dialog', dialogStore);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update(ids.map((id) => createMessageEntity(String(id), '7')));
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice(ids);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow([newest]);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ hasMoreHistory: false });

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.slideListedWindow('7', 'older');

    expect(call).not.toHaveBeenCalled();
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(ids.map(String));
    expect(globalStore.getThreadUI('7', '-1')?.isLoadingHistory).toBe(false);
  });

  it('slideListedWindow does not refetch after cache-sliding to the oldest when hasMoreHistory is false', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ unreadCount: 0, topMessageId: '20' })]);
    sm.set('dialog', dialogStore);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const ids = Array.from({ length: 20 }, (_, i) => i + 1);
    messageStore.update(ids.map((id) => createMessageEntity(String(id), '7')));
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice(ids);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['11', '20']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ hasMoreHistory: false });

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.slideListedWindow('7', 'older');

    expect(call).not.toHaveBeenCalled();
    expect(globalStore.getThreadUI('7', '-1')?.listedIds[0]).toBe('1');
    expect(globalStore.getThreadUI('7', '-1')?.hasMoreOlder).toBe(false);
  });

  it('slideListedWindow fetches at a private island break even when hasMoreHistory is false', async () => {
    const call = jest.fn((method: string) => {
      if (method === 'message.loadHistory') {
        return Promise.resolve({
          messages: [
            { id: 70, date: 1, message: 'older', out: false, peer_id: { userId: '7' } },
            { id: 71, date: 2, message: 'older-b', out: false, peer_id: { userId: '7' } },
          ],
          messageServices: [],
          users: [],
          chats: [],
          channels: [],
        });
      }
      return Promise.resolve(undefined);
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([
      createMessageEntity('10', '7'),
      createMessageEntity('12', '7'),
      createMessageEntity('14', '7'),
      createMessageEntity('79', '7'),
      createMessageEntity('80', '7'),
    ]);
    sm.set('7-message', messageStore);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ unreadCount: 0, topMessageId: '80' })]);
    sm.set('dialog', dialogStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([10, 12, 14]);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([79, 80]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['79', '80']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ hasMoreHistory: false });

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.slideListedWindow('7', 'older');

    expect(call).toHaveBeenCalledWith('message.loadHistory', [
      '7',
      { direction: 'backwards', offsetId: 79, limit: GET_HISTORY_LIMIT },
    ]);
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['70', '71', '79', '80']);
  });

  it('setPinToBottom and clearFocus update thread UI state', () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);

    controller.setPinToBottom('7', false);
    expect(globalStore.getThreadUI('7', '-1')?.pinToBottom).toBe(false);

    controller.recordScrollOffset('7', 240);
    expect(globalStore.getThreadUI('7', '-1')?.scrollOffset).toBe(240);

    globalStore.getOrCreateThreadUI('7', '-1').beginFocus('42');
    controller.clearFocus('7');
    expect(globalStore.getThreadUI('7', '-1')?.focusedMessageId).toBeUndefined();
  });

  it('selectDialog fills the listed window from a full cache run without fetching', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ unreadCount: 0, topMessageId: '50' })]);
    sm.set('dialog', dialogStore);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const ids = Array.from({ length: 100 }, (_, i) => i + 1);
    messageStore.update(ids.map((id) => createMessageEntity(String(id), '7')));
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice(ids);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.selectDialog('7');

    expect(call).not.toHaveBeenCalled();
    expect(globalStore.nav.selectedDialogId).toBe('7');
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toHaveLength(GET_HISTORY_LIMIT);
    expect(globalStore.getThreadUI('7', '-1')?.listedIds[0]).toBe('26');
    expect(globalStore.getThreadUI('7', '-1')?.listedIds.at(-1)).toBe('75');
    expect(globalStore.getThreadUI('7', '-1')?.historyLoaded).toBe(true);
    expect(globalStore.getThreadUI('7', '-1')?.isLoadingHistory).toBe(false);
  });

  it('selectDialog restores the listed window from global store without fetching', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([
      createMessageEntity('8', '7'),
      createMessageEntity('9', '7'),
      createMessageEntity('10', '7'),
    ]);
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([8, 9, 10]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['8', '9', '10']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ historyLoaded: true });
    globalStore.getOrCreateThreadUI('7', '-1').recordScrollOffset(240);
    globalStore.getOrCreateThreadUI('7', '-1').setPinToBottom(false);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.selectDialog('7');

    expect(globalStore.nav.selectedDialogId).toBe('7');
    expect(call).not.toHaveBeenCalled();
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['8', '9', '10']);
    expect(globalStore.getThreadUI('7', '-1')?.scrollOffset).toBe(240);
    expect(globalStore.getThreadUI('7', '-1')?.pinToBottom).toBe(false);
    expect(globalStore.getThreadUI('7', '-1')?.historyLoaded).toBe(true);
  });

  it('selectDialog fetches listed ids that are missing from msgIndexes', async () => {
    const call = jest.fn((method: string) => {
      if (method === 'message.getMessagesByIds') {
        return Promise.resolve({
          messages: [
            { id: 8, date: 1, message: 'a', out: false, peer_id: { userId: '7' } },
            { id: 9, date: 2, message: 'b', out: false, peer_id: { userId: '7' } },
            { id: 10, date: 3, message: 'c', out: false, peer_id: { userId: '7' } },
          ],
          messageServices: [],
          emptyMessages: [],
        });
      }
      return Promise.resolve(undefined);
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['8', '9', '10']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ historyLoaded: true });

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.selectDialog('7');

    expect(call).toHaveBeenCalledWith('message.getMessagesByIds', ['7', [8, 9, 10]]);
    expect(call).not.toHaveBeenCalledWith('message.loadHistory', expect.anything());
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['8', '9', '10']);
    expect(globalStore.getThreadUI('7', '-1')?.msgIndexes.cachedIds).toEqual([8, 9, 10]);
    expect(messageStore.get('8')).toBeDefined();
    expect(messageStore.get('10')).toBeDefined();
    expect(globalStore.getThreadUI('7', '-1')?.isLoadingHistory).toBe(false);
  });

  it('selectDialog fetches listed ids that are in msgIndexes but missing from the message store', async () => {
    const call = jest.fn((method: string) => {
      if (method === 'message.getMessagesByIds') {
        return Promise.resolve({
          messages: [
            { id: 8, date: 1, message: 'a', out: false, peer_id: { userId: '7' } },
            { id: 9, date: 2, message: 'b', out: false, peer_id: { userId: '7' } },
          ],
          messageServices: [],
          emptyMessages: [],
        });
      }
      return Promise.resolve(undefined);
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([8, 9]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['8', '9']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ historyLoaded: true });

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.selectDialog('7');

    expect(call).toHaveBeenCalledWith('message.getMessagesByIds', ['7', [8, 9]]);
    expect(messageStore.get('8')).toBeDefined();
    expect(messageStore.get('9')).toBeDefined();
    expect(globalStore.getThreadUI('7', '-1')?.msgIndexes.cachedIds).toEqual([8, 9]);
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['8', '9']);
  });

  it('selectDialog fetches only the listed ids that are not already cached', async () => {
    const call = jest.fn((method: string) => {
      if (method === 'message.getMessagesByIds') {
        return Promise.resolve({
          messages: [
            { id: 9, date: 2, message: 'b', out: false, peer_id: { userId: '7' } },
            { id: 10, date: 3, message: 'c', out: false, peer_id: { userId: '7' } },
          ],
          messageServices: [],
          emptyMessages: [],
        });
      }
      return Promise.resolve(undefined);
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([createMessageEntity('8', '7')]);
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([8]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['8', '9', '10']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ historyLoaded: true });

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.selectDialog('7');

    expect(call).toHaveBeenCalledWith('message.getMessagesByIds', ['7', [9, 10]]);
    expect(globalStore.getThreadUI('7', '-1')?.msgIndexes.cachedIds).toEqual([8, 9, 10]);
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['8', '9', '10']);
  });

  it('selectDialog hydrates listed ids from SDK cache IDB before remote', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([8, 9]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['8', '9']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ historyLoaded: true });

    const loadCachedMessages = jest.fn(async (_peerId: string, ids: string[]) =>
      ids.map((id) => createMessageEntity(id, '7')),
    );
    const {
      load: controller,
      read,
      send,
      draft,
    } = createControllers(sm, call, globalStore, undefined, loadCachedMessages);
    await controller.selectDialog('7');

    expect(loadCachedMessages).toHaveBeenCalledWith('7', ['8', '9']);
    expect(call).not.toHaveBeenCalled();
    expect(messageStore.getAllData().get('8')?.date).toBeDefined();
    expect(messageStore.getAllData().get('9')?.date).toBeDefined();
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['8', '9']);
    expect(globalStore.getThreadUI('7', '-1')?.msgIndexes.cachedIds).toEqual([8, 9]);
  });

  it('ensureListedIdsCached hydrates persisted listed ids from SDK cache IDB', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([8, 9]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['8', '9']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ historyLoaded: true });
    globalStore.nav.setSelectedDialogId('7');

    const loadCachedMessages = jest.fn(async (_peerId: string, ids: string[]) =>
      ids.map((id) => createMessageEntity(id, '7')),
    );
    const {
      load: controller,
      read,
      send,
      draft,
    } = createControllers(sm, call, globalStore, undefined, loadCachedMessages);
    await controller.ensureListedIdsCached('7');

    expect(loadCachedMessages).toHaveBeenCalledWith('7', ['8', '9']);
    expect(call).not.toHaveBeenCalled();
    expect(messageStore.getAllData().get('8')?.date).toBeDefined();
    expect(messageStore.getAllData().get('9')?.date).toBeDefined();
    expect(
      globalStore.getThreadUI('7', '-1')?.flatItems.some((item) => item.kind === 'message'),
    ).toBe(true);
  });

  it('selectDialog remotes only listed ids missing from SDK cache IDB', async () => {
    const call = jest.fn((method: string) => {
      if (method === 'message.getMessagesByIds') {
        return Promise.resolve({
          messages: [{ id: 10, date: 3, message: 'c', out: false, peer_id: { userId: '7' } }],
          messageServices: [],
          emptyMessages: [],
        });
      }
      return Promise.resolve(undefined);
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['8', '10']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ historyLoaded: true });

    const loadCachedMessages = jest.fn(async (_peerId: string, ids: string[]) =>
      ids.filter((id) => id === '8').map((id) => createMessageEntity(id, '7')),
    );
    const {
      load: controller,
      read,
      send,
      draft,
    } = createControllers(sm, call, globalStore, undefined, loadCachedMessages);
    await controller.selectDialog('7');

    expect(loadCachedMessages).toHaveBeenCalledWith('7', ['8', '10']);
    expect(call).toHaveBeenCalledWith('message.getMessagesByIds', ['7', [10]]);
    expect(messageStore.getAllData().get('8')?.date).toBeDefined();
    expect(messageStore.getAllData().get('10')?.date).toBeDefined();
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['8', '10']);
  });

  it('selectDialog covers listed ids from the entity store without a remote fetch', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([
      createMessageEntity('8', '7'),
      createMessageEntity('9', '7'),
      createMessageEntity('10', '7'),
    ]);
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['8', '9', '10']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ historyLoaded: true });

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.selectDialog('7');

    expect(call).not.toHaveBeenCalled();
    expect(globalStore.getThreadUI('7', '-1')?.msgIndexes.cachedIds).toEqual([8, 9, 10]);
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['8', '9', '10']);
  });

  it('selectDialog does not refetch listed ids that are known deleted', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([createMessageEntity('8', '7'), createMessageEntity('10', '7')]);
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([8, 10]);
    globalStore.getOrCreateThreadUI('7').markCachedDeleted([9]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['8', '9', '10']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ historyLoaded: true });

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.selectDialog('7');

    expect(call).not.toHaveBeenCalled();
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['8', '10']);
    expect(globalStore.getThreadUI('7', '-1')?.msgIndexes.cachedIds).toEqual([8, 10]);
  });

  it('selectDialog drops listed ids that the server returns as empty', async () => {
    const call = jest.fn((method: string) => {
      if (method === 'message.getMessagesByIds') {
        return Promise.resolve({
          messages: [{ id: 8, date: 1, message: 'a', out: false, peer_id: { userId: '7' } }],
          messageServices: [],
          emptyMessages: [{ id: 9 }],
        });
      }
      return Promise.resolve(undefined);
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['8', '9']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ historyLoaded: true });

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.selectDialog('7');

    expect(call).toHaveBeenCalledWith('message.getMessagesByIds', ['7', [8, 9]]);
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['8']);
    expect(globalStore.getThreadUI('7', '-1')?.msgIndexes.cachedIds).toEqual([8]);
    expect(globalStore.getThreadUI('7', '-1')?.msgIndexes.deletedIds).toContain(9);
  });

  it('selectDialog loads around latest when the listed window is empty', async () => {
    const call = jest.fn().mockResolvedValue({
      messages: [
        { id: 9, date: 1, message: 'a', out: false, peer_id: { userId: '7' } },
        { id: 10, date: 2, message: 'b', out: false, peer_id: { userId: '7' } },
      ],
      messageServices: [],
      users: [],
      chats: [],
      channels: [],
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ unreadCount: 0, readInboxMaxId: 5, topMessageId: '10' })]);
    sm.set('dialog', dialogStore);
    sm.set(
      '7-message',
      new EntityStore<Message, MessageEntity>({
        model: Message,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.selectDialog('7');

    expect(globalStore.nav.selectedDialogId).toBe('7');
    expect(call).toHaveBeenCalledWith('message.loadHistory', [
      '7',
      { direction: 'around', offsetId: 10, limit: GET_HISTORY_LIMIT },
    ]);
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['9', '10']);
    expect(globalStore.getThreadUI('7', '-1')?.historyLoaded).toBe(true);
    expect(globalStore.getThreadUI('7', '-1')?.isLoadingHistory).toBe(false);
    expect(globalStore.getThreadUI('7', '-1')?.hasMoreNewer).toBe(false);
  });

  it('selectDialog jumps to the first unread without highlight', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ unreadCount: 3, readInboxMaxId: 9, topMessageId: '12' })]);
    sm.set('dialog', dialogStore);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([
      createMessageEntity('9', '7'),
      createMessageEntity('10', '7'),
      createMessageEntity('11', '7'),
      createMessageEntity('12', '7'),
    ]);
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([9, 10, 11, 12]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['9', '10', '11', '12']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ historyLoaded: true });

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.selectDialog('7');

    expect(call).not.toHaveBeenCalled();
    expect(globalStore.getThreadUI('7', '-1')?.focusedMessageId).toBe('10');
    expect(globalStore.getThreadUI('7', '-1')?.focusNoHighlight).toBe(true);
    expect(globalStore.getThreadUI('7', '-1')?.pinToBottom).toBe(false);
    expect(globalStore.getThreadUI('7', '-1')?.unreadDividerId).toBe('10');
    expect(globalStore.getThreadUI('7', '-1')?.listedIds).toEqual(['9', '10', '11', '12']);
  });

  it('selectDialog loads unread reactions without waiting to mark them read', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ unreadCount: 0, readInboxMaxId: 12, topMessageId: '12' })]);
    sm.set('dialog', dialogStore);
    sm.set(
      '7-message',
      new EntityStore<Message, MessageEntity>({
        model: Message,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );
    globalStore.getOrCreateThreadUI('7').setHistoryState({ historyLoaded: true });
    let releaseLoad: (() => void) | undefined;
    const loadUnreadReactionsOnOpen = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseLoad = resolve;
        }),
    );
    const { load: controller } = createControllers(
      sm,
      call,
      globalStore,
      undefined,
      undefined,
      loadUnreadReactionsOnOpen,
    );

    await controller.selectDialog('7');

    expect(loadUnreadReactionsOnOpen).toHaveBeenCalledWith('7');
    expect(globalStore.nav.selectedDialogId).toBe('7');
    expect(call).not.toHaveBeenCalled();
    releaseLoad?.();
  });

  it('selectDialog loads around the first unread when the listed window is empty', async () => {
    const call = jest.fn().mockResolvedValue({
      messages: [
        { id: 6, date: 1, message: 'unread-a', out: false, peer_id: { userId: '7' } },
        { id: 7, date: 2, message: 'unread-b', out: false, peer_id: { userId: '7' } },
      ],
      messageServices: [],
      users: [],
      chats: [],
      channels: [],
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ unreadCount: 3, readInboxMaxId: 5, topMessageId: '10' })]);
    sm.set('dialog', dialogStore);
    sm.set(
      '7-message',
      new EntityStore<Message, MessageEntity>({
        model: Message,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await controller.selectDialog('7');

    expect(call).toHaveBeenCalledWith('message.loadHistory', [
      '7',
      { direction: 'around', offsetId: 6, limit: GET_HISTORY_LIMIT },
    ]);
    expect(globalStore.getThreadUI('7', '-1')?.focusedMessageId).toBe('6');
    expect(globalStore.getThreadUI('7', '-1')?.focusNoHighlight).toBe(true);
    expect(globalStore.getThreadUI('7', '-1')?.pinToBottom).toBe(false);
    expect(globalStore.getThreadUI('7', '-1')?.unreadDividerId).toBe('6');
  });

  it('focusNextReply returns scrollToBottom when stack is empty', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    sm.set(
      '7-message',
      new EntityStore<Message, MessageEntity>({
        model: Message,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    const result = await controller.focusNextReply('7');

    expect(result).toEqual({ scrollToBottom: true });
  });
});

describe('MessageReadController.markMessageListRead', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('optimistically advances readInboxMaxId and decrements unreadCount', () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog()]);
    sm.set('dialog', dialogStore);

    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([
      createMessageEntity('6', '7', false),
      createMessageEntity('7', '7', false),
      createMessageEntity('8', '7', false),
    ]);
    sm.set('7-message', messageStore);

    const { load: controller, read, send, draft } = createControllers(sm, call);

    read.markMessageListRead('7', 8);

    const dialog = dialogStore.get('7');
    expect(dialog?.readInboxMaxId).toBe(8);
    expect(dialog?.unreadCount).toBe(0);
    expect(call).toHaveBeenCalledWith('message.markMessageListRead', ['7', 8]);
  });

  it('clears unreadCount when the visible maxId reaches the dialog top', () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([
      createDialog({ unreadCount: 300, readInboxMaxId: 5, topMessageId: '400' }),
    ]);
    sm.set('dialog', dialogStore);

    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([
      createMessageEntity('390', '7', false),
      createMessageEntity('400', '7', false),
    ]);
    sm.set('7-message', messageStore);

    const { load: controller, read, send, draft } = createControllers(sm, call);
    read.markMessageListRead('7', 400);

    const dialog = dialogStore.get('7');
    expect(dialog?.readInboxMaxId).toBe(400);
    expect(dialog?.unreadCount).toBe(0);
    expect(call).toHaveBeenCalledWith('message.markMessageListRead', ['7', 400]);
  });

  it('waits 3s of idle pointer before sending readHistory while unread remains', () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([
      createDialog({ unreadCount: 300, readInboxMaxId: 5, topMessageId: '400' }),
    ]);
    sm.set('dialog', dialogStore);

    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([
      createMessageEntity('10', '7', false),
      createMessageEntity('20', '7', false),
    ]);
    sm.set('7-message', messageStore);

    const { load: controller, read, send, draft } = createControllers(sm, call);
    read.markMessageListRead('7', 10);
    jest.advanceTimersByTime(2_000);
    read.markMessageListRead('7', 20);
    jest.advanceTimersByTime(2_000);
    expect(call).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1_000);
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith('message.markMessageListRead', ['7', 20]);
  });

  it('flushes pending readHistory immediately on close', () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([
      createDialog({ unreadCount: 300, readInboxMaxId: 5, topMessageId: '400' }),
    ]);
    sm.set('dialog', dialogStore);
    sm.set(
      '7-message',
      new EntityStore<Message, MessageEntity>({
        model: Message,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );

    const { load: controller, read, send, draft } = createControllers(sm, call);
    read.markMessageListRead('7', 20);
    expect(call).not.toHaveBeenCalled();

    read.flushPendingInboxRead('7');
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith('message.markMessageListRead', ['7', 20]);
  });

  it('does not report a maxId that was already sent', () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([
      createDialog({ unreadCount: 300, readInboxMaxId: 5, topMessageId: '400' }),
    ]);
    sm.set('dialog', dialogStore);
    sm.set(
      '7-message',
      new EntityStore<Message, MessageEntity>({
        model: Message,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );

    const { load: controller, read, send, draft } = createControllers(sm, call);
    read.markMessageListRead('7', 400);
    expect(call).toHaveBeenCalledTimes(1);

    read.markMessageListRead('7', 400);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('keeps the unread divider frozen while marking read in an open list', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    dialogStore.update([createDialog({ unreadCount: 3, readInboxMaxId: 5 })]);
    sm.set('dialog', dialogStore);

    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([
      createMessageEntity('6', '7', false),
      createMessageEntity('7', '7', false),
      createMessageEntity('8', '7', false),
    ]);
    sm.set('7-message', messageStore);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['6', '7', '8']);
    globalStore.getOrCreateThreadUI('7').setHistoryState({ historyLoaded: true });
    globalStore.getOrCreateThreadUI('7').freezeUnreadDivider();
    expect(globalStore.getThreadUI('7')?.unreadDividerId).toBe('6');

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    read.markMessageListRead('7', 7);
    expect(globalStore.getThreadUI('7')?.unreadDividerId).toBe('6');

    read.markMessageListRead('7', 8);
    expect(globalStore.getThreadUI('7')?.unreadDividerId).toBe('6');

    await controller.selectDialog('7');
    expect(globalStore.getThreadUI('7')?.unreadDividerId).toBeUndefined();
  });
});

describe('MessageReadController.markMentionsRead', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('optimistically clears mention flags and debounces the worker call', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('dialog', dialogStore);
    dialogStore.update([createDialog({ unreadMentionsCount: 2, readInboxMaxId: 5 })]);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    messageStore.update([
      new Message({
        ...createMessageEntity('20', '7'),
        mentioned: true,
        mediaUnread: true,
      }),
    ]);
    globalStore.getOrCreateDialogUI('7').setUnreadMentionIds(['20']);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    read.markMentionsRead('7', ['20']);

    const message = messageStore.get('20');
    expect(message.hasUnreadMention).toBe(false);
    expect(globalStore.getDialogUI('7')?.unreadMentionIds).toEqual([]);
    expect(call).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    await Promise.resolve();
    expect(call).toHaveBeenCalledWith('message.markMentionsRead', ['7', [20]]);
  });
});

describe('MessageReadController.markMediaRead', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function setup() {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('dialog', dialogStore);
    dialogStore.update([createDialog({ unreadMentionsCount: 1, readInboxMaxId: 5 })]);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    return { call, sm, globalStore, dialogStore, messageStore };
  }

  it('clears mediaUnread and debounces readMessageContents', async () => {
    const { call, sm, globalStore, messageStore } = setup();
    messageStore.update([
      new Message({
        ...createMessageEntity('21', '7'),
        mediaUnread: true,
      }),
    ]);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    read.markMediaRead('7', ['21']);

    expect(messageStore.get('21').mediaUnread).toBe(false);
    expect(call).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    await Promise.resolve();
    expect(call).toHaveBeenCalledWith('message.markMentionsRead', ['7', [21]]);
  });

  it('drops a shared unread mention along with the media flag', async () => {
    const { call, sm, globalStore, dialogStore, messageStore } = setup();
    messageStore.update([
      new Message({
        ...createMessageEntity('22', '7'),
        mentioned: true,
        mediaUnread: true,
      }),
    ]);
    globalStore.getOrCreateDialogUI('7').setUnreadMentionIds(['22']);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    read.markMediaRead('7', ['22']);

    expect(messageStore.get('22').mediaUnread).toBe(false);
    expect(messageStore.get('22').hasUnreadMention).toBe(false);
    expect(globalStore.getDialogUI('7')?.unreadMentionIds).toEqual([]);
    expect(dialogStore.get('7')?.unreadMentionsCount).toBeUndefined();

    jest.advanceTimersByTime(500);
    await Promise.resolve();
    expect(call).toHaveBeenCalledWith('message.markMentionsRead', ['7', [22]]);
  });
});

describe('MessageReadController.focusClosestUnreadMention', () => {
  it('focuses the unread mention closest to the listed anchor', async () => {
    const call = jest.fn().mockResolvedValue({
      messages: [],
      messageServices: [],
      users: [],
      chats: [],
      channels: [],
      emptyMessages: [],
      messageIds: ['10', '30'],
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('dialog', dialogStore);
    dialogStore.update([createDialog({ unreadMentionsCount: 2 })]);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    messageStore.update([
      new Message({
        ...createMessageEntity('10', '7'),
        mentioned: true,
        mediaUnread: true,
      }),
      new Message({
        ...createMessageEntity('30', '7'),
        mentioned: true,
        mediaUnread: true,
      }),
    ]);
    globalStore.getOrCreateDialogUI('7').setUnreadMentionIds(['30', '10']);
    const threadUI = globalStore.getOrCreateThreadUI('7');
    threadUI.listedIds = ['5', '10', '20', '30', '40'];

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    const focusSpy = jest.spyOn(controller, 'focusMessage').mockResolvedValue(undefined);

    await read.focusClosestUnreadMention('7', '-1', '20');

    expect(focusSpy).toHaveBeenCalledWith('7', {
      messageId: '30',
      threadId: '-1',
    });
  });
});

describe('MessageLoadController.selectDialogByUsername', () => {
  it('opens the dialog for a resolved username', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const resolveUsername = jest.fn().mockResolvedValue('42');
    const {
      load: controller,
      read,
      send,
      draft,
    } = createControllers(sm, call, globalStore, resolveUsername);
    const selectSpy = jest.spyOn(controller, 'selectDialog').mockResolvedValue(undefined);

    await controller.selectDialogByUsername('@alice');

    expect(resolveUsername).toHaveBeenCalledWith('@alice');
    expect(selectSpy).toHaveBeenCalledWith('42', '-1');
  });

  it('no-ops when username resolution fails', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const resolveUsername = jest.fn().mockResolvedValue(undefined);
    const {
      load: controller,
      read,
      send,
      draft,
    } = createControllers(sm, call, globalStore, resolveUsername);
    const selectSpy = jest.spyOn(controller, 'selectDialog').mockResolvedValue(undefined);

    await controller.selectDialogByUsername('missing');

    expect(selectSpy).not.toHaveBeenCalled();
  });
});

describe('MessageLoadController.getMessagesByIds cache', () => {
  it('returns SDK cache hits without calling the worker', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    const loadCachedMessages = jest.fn(async () => [createMessageEntity('8', '7')]);
    const {
      load: controller,
      read,
      send,
      draft,
    } = createControllers(sm, call, new GlobalStore(sm), undefined, loadCachedMessages);

    const messages = await controller.getMessagesByIds('7', ['8']);

    expect(loadCachedMessages).toHaveBeenCalledWith('7', ['8']);
    expect(call).not.toHaveBeenCalled();
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('8');
    expect(messageStore.getAllData().get('8')?.date).toBeDefined();
  });

  it('verifyReplyTargetExists always hits the worker', async () => {
    const call = jest.fn().mockResolvedValue({
      messages: [{ id: 8, date: 1, message: 'a', out: false, peer_id: { userId: '7' } }],
      messageServices: [],
      emptyMessages: [],
    });
    const sm = new StoreManager();
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    const loadCachedMessages = jest.fn(async () => [createMessageEntity('8', '7')]);
    const {
      load: controller,
      read,
      send,
      draft,
    } = createControllers(sm, call, new GlobalStore(sm), undefined, loadCachedMessages);

    await expect(controller.verifyReplyTargetExists('7', '8')).resolves.toBe(true);
    expect(call).toHaveBeenCalledWith('message.getMessagesByIds', ['7', [8]]);
  });
});

describe('MessageLoadController pinned messages', () => {
  it('loadPinnedMessages returns cached messages without waiting for remote', async () => {
    const call = jest.fn().mockResolvedValue({
      messages: [
        { id: 99, peerId: '7', date: 200, message: 'fresh pin', out: false, pinned: true },
      ],
      messageServices: [],
      users: [],
      chats: [],
      channels: [],
      count: 1,
    });
    const sm = new StoreManager();
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    messageStore.update([{ ...createMessageEntity('42', '7'), pinned: true }]);
    const globalStore = new GlobalStore(sm);
    globalStore.getOrCreateDialogUI('7').setPinnedMessages([42], 1);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);

    const messages = await controller.loadPinnedMessages('7');

    expect(messages).toHaveLength(1);
    expect((messages as Message[])[0].id).toBe('42');
    expect(call).toHaveBeenCalledWith('message.getPinnedMessages', ['7']);
    expect(globalStore.getDialogUI('7')?.pinnedMessageIds).toEqual([42]);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(globalStore.getDialogUI('7')?.pinnedMessageIds).toEqual([99]);
  });

  it('loadPinnedMessages fetches pinned messages in the background', async () => {
    const call = jest.fn().mockResolvedValue({
      messages: [
        { id: 42, peerId: '7', date: 100, message: 'pinned text', out: false, pinned: true },
      ],
      messageServices: [],
      users: [],
      chats: [],
      channels: [],
      count: 1,
    });
    const sm = new StoreManager();
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    const globalStore = new GlobalStore(sm);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);

    await expect(controller.loadPinnedMessages('7')).resolves.toEqual([]);

    expect(call).toHaveBeenCalledWith('message.getPinnedMessages', ['7']);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const dialogUI = globalStore.getDialogUI('7');
    expect(dialogUI?.pinnedMessageIds).toEqual([42]);
    expect(dialogUI?.pinnedMessagesCount).toBe(1);
  });

  it('loadPinnedMessages debounces repeated background fetches for the same peer', async () => {
    const call = jest.fn().mockResolvedValue({
      messages: [],
      messageServices: [],
      users: [],
      chats: [],
      channels: [],
      count: 0,
    });
    const sm = new StoreManager();
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    const {
      load: controller,
      read,
      send,
      draft,
    } = createControllers(sm, call, new GlobalStore(sm));

    controller.loadPinnedMessages('7');
    controller.loadPinnedMessages('7');

    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith('message.getPinnedMessages', ['7']);
  });

  it('openPinnedView and closePinnedView toggle dialogUI.isPinnedViewOpen', async () => {
    const call = jest.fn().mockResolvedValue({
      messages: [],
      messageServices: [],
      users: [],
      chats: [],
      channels: [],
      count: 0,
    });
    const sm = new StoreManager();
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    const globalStore = new GlobalStore(sm);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);

    await controller.openPinnedView('7');
    await controller.loadPinnedMessages('7');
    expect(globalStore.getDialogUI('7')?.isPinnedViewOpen).toBe(true);

    controller.closePinnedView('7');
    expect(globalStore.getDialogUI('7')?.isPinnedViewOpen).toBe(false);
  });

  it('cyclePinnedMessage cycles index and focuses on the pinned message', async () => {
    const call = jest.fn().mockResolvedValue({ messages: [] });
    const sm = new StoreManager();
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    const globalStore = new GlobalStore(sm);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);

    globalStore.getOrCreateDialogUI('7').setPinnedMessages([10, 20, 30], 3);
    const focusSpy = jest.spyOn(controller, 'focusMessage').mockResolvedValue(undefined);

    await controller.cyclePinnedMessage('7');
    expect(globalStore.getDialogUI('7')?.currentPinnedIndex).toBe(1);
    expect(focusSpy).toHaveBeenCalledWith('7', { messageId: '20' });

    await controller.cyclePinnedMessage('7');
    expect(globalStore.getDialogUI('7')?.currentPinnedIndex).toBe(2);
    expect(focusSpy).toHaveBeenCalledWith('7', { messageId: '30' });

    await controller.cyclePinnedMessage('7');
    expect(globalStore.getDialogUI('7')?.currentPinnedIndex).toBe(0);
    expect(focusSpy).toHaveBeenCalledWith('7', { messageId: '10' });
  });

  it('unpinAllMessages calls worker and clears pinned state and cached messages', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    messageStore.update([
      createMessageEntity('10', '7'),
      { ...createMessageEntity('20', '7'), pinned: true },
    ]);
    const globalStore = new GlobalStore(sm);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);

    globalStore.getOrCreateDialogUI('7').setPinnedMessages([20], 1);
    globalStore.getOrCreateDialogUI('7').setPinnedViewOpen(true);

    await controller.unpinAllMessages('7');
    expect(call).toHaveBeenCalledWith('message.unpinAllMessages', ['7']);
    expect(globalStore.getDialogUI('7')?.pinnedMessageIds).toEqual([]);
    expect(globalStore.getDialogUI('7')?.isPinnedViewOpen).toBe(false);
    expect(messageStore.getAllData().get('20')?.pinned).toBe(false);
  });
});

describe('MessageSendController.sendText', () => {
  const CHANNEL_ID = '-1000000000009';

  function entityStore<M extends EntityWithId, E extends Entity>(model: new (data: E) => M) {
    return new EntityStore<M, E>({
      model,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
  }

  it('forwards a channel access hash and the reply id', async () => {
    const call = jest.fn().mockResolvedValue(55);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const channelStore = entityStore<Channel, ChannelEntity>(Channel);
    channelStore.update([
      new Channel({
        id: CHANNEL_ID,
        accessHash: 'chan-hash',
        title: 'News',
        status: 'active',
      }),
    ]);
    sm.set('channel', channelStore);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    draft.setReplyingTo(CHANNEL_ID, '12');

    await expect(send.sendText(CHANNEL_ID, 'hello')).resolves.toEqual({
      ok: true,
      messageId: 55,
    });
    expect(call).toHaveBeenCalledWith('message.sendMessage', [
      CHANNEL_ID,
      'hello',
      'chan-hash',
      undefined,
      12,
    ]);
    expect(globalStore.getThreadUI(CHANNEL_ID)?.replyingToId).toBeUndefined();
  });

  it('forwards a user access hash and omits it for a basic group', async () => {
    const call = jest.fn().mockResolvedValue(8);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const userStore = entityStore<User, UserEntity>(User);
    userStore.update([new User({ id: '7', accessHash: 'user-hash', firstName: 'Ada' })]);
    sm.set('user', userStore);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);

    await send.sendText('7', 'hi');
    expect(call).toHaveBeenCalledWith('message.sendMessage', [
      '7',
      'hi',
      'user-hash',
      undefined,
      undefined,
    ]);

    call.mockClear();
    draft.setDraft('7', {
      text: '😁',
      entities: [
        {
          className: 'MessageEntityCustomEmoji',
          offset: 0,
          length: 2,
          documentId: '99',
        },
      ],
    });
    await send.sendText('7', '😁');
    expect(call).toHaveBeenCalledWith('message.sendMessage', [
      '7',
      '😁',
      'user-hash',
      undefined,
      undefined,
      [{ offset: 0, length: 2, documentId: '99' }],
    ]);

    call.mockClear();
    await send.sendText('-42', 'group');
    expect(call).toHaveBeenCalledWith('message.sendMessage', [
      '-42',
      'group',
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('keeps the reply target when send returns -1', async () => {
    const call = jest.fn().mockResolvedValue(-1);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    draft.setReplyingTo('7', '4');

    await expect(send.sendText('7', 'nope')).resolves.toEqual({ ok: false });
    expect(globalStore.getThreadUI('7')?.replyingToId).toBe('4');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('keeps the reply target when send throws', async () => {
    const call = jest.fn().mockRejectedValue(new Error('rpc'));
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    draft.setReplyingTo('7', '4');

    await expect(send.sendText('7', 'nope')).resolves.toEqual({ ok: false });
    expect(globalStore.getThreadUI('7')?.replyingToId).toBe('4');
  });

  it('jumps to the bottom when the thread is scrolled up', async () => {
    const call = jest.fn().mockResolvedValue(21);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = entityStore<Message, MessageEntity>(Message);
    const dialogStore = entityStore<Dialog, DialogEntity>(Dialog);
    sm.set('7-message', messageStore);
    sm.set('dialog', dialogStore);
    dialogStore.update([createDialog({ topMessageId: '10' })]);
    messageStore.update([createMessageEntity('9', '7'), createMessageEntity('10', '7')]);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([9, 10]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['9', '10']);
    globalStore.getOrCreateThreadUI('7').setPinToBottom(false);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await expect(send.sendText('7', 'hello')).resolves.toEqual({ ok: true, messageId: 21 });

    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith('message.sendMessage', [
      '7',
      'hello',
      undefined,
      undefined,
      undefined,
    ]);
    expect(globalStore.getThreadUI('7')?.pinToBottom).toBe(true);
  });

  it('leaves the listed window when the thread is already pinned to the newest messages', async () => {
    const call = jest.fn().mockResolvedValue(21);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    sm.set('dialog', entityStore<Dialog, DialogEntity>(Dialog));
    sm.get('dialog').update([createDialog({ topMessageId: '10' })]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['9', '10']);
    globalStore.getOrCreateThreadUI('7').setPinToBottom(true);

    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    await send.sendText('7', 'hello');

    expect(call).toHaveBeenCalledTimes(1);
    expect(globalStore.getThreadUI('7')?.listedIds).toEqual(['9', '10']);
    expect(globalStore.getThreadUI('7')?.pinToBottom).toBe(true);
    expect(globalStore.getThreadUI('7')?.listedFollowsNewest).toBe(true);
  });
});

describe('MessageSendController.sendSticker', () => {
  const document = {
    id: '9',
    accessHash: '8',
    fileReference: 'YWI=',
    setId: '1',
    setAccessHash: '2',
  };

  it('forwards the document and clears the reply', async () => {
    const call = jest.fn().mockResolvedValue(55);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const { send, draft } = createControllers(sm, call, globalStore);
    draft.setReplyingTo('7', '12');

    await expect(send.sendSticker('7', document)).resolves.toEqual({ ok: true, messageId: 55 });
    expect(call).toHaveBeenCalledWith('message.sendSticker', ['7', document, undefined, 12]);
    expect(globalStore.getThreadUI('7')?.replyingToId).toBeUndefined();
  });

  it('jumps to the bottom when the thread is scrolled up', async () => {
    const call = jest.fn().mockResolvedValue(21);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    sm.set('dialog', dialogStore);
    dialogStore.update([createDialog({ topMessageId: '10' })]);
    messageStore.update([createMessageEntity('9', '7'), createMessageEntity('10', '7')]);
    globalStore.getOrCreateThreadUI('7').ingestHistorySlice([9, 10]);
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['9', '10']);
    globalStore.getOrCreateThreadUI('7').setPinToBottom(false);

    const { send } = createControllers(sm, call, globalStore);
    await expect(send.sendSticker('7', document)).resolves.toEqual({ ok: true, messageId: 21 });
    expect(globalStore.getThreadUI('7')?.pinToBottom).toBe(true);
  });

  it('keeps the reply target when send throws', async () => {
    const call = jest.fn().mockRejectedValue(new Error('rpc'));
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const { send, draft } = createControllers(sm, call, globalStore);
    draft.setReplyingTo('7', '4');

    await expect(send.sendSticker('7', document)).resolves.toEqual({ ok: false });
    expect(globalStore.getThreadUI('7')?.replyingToId).toBe('4');
  });
});

describe('MessageSendController.sendFile', () => {
  const file = {
    name: 'photo.jpg',
    type: 'image/jpeg',
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
  } as unknown as File;

  it('sends file with caption and clears reply target', async () => {
    const call = jest.fn().mockResolvedValue(101);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const { send, draft } = createControllers(sm, call, globalStore);
    draft.setReplyingTo('7', '15');

    await expect(send.sendFile('7', file, 'nice photo')).resolves.toEqual({
      ok: true,
      messageId: 101,
    });
    expect(call).toHaveBeenCalledWith(
      'message.sendMedia',
      [
        '7',
        expect.objectContaining({ name: 'photo.jpg', type: 'image/jpeg' }),
        'nice photo',
        undefined,
        undefined,
        15,
        undefined,
      ],
      expect.objectContaining({ transfer: expect.any(Array) }),
    );
    expect(globalStore.getThreadUI('7')?.replyingToId).toBeUndefined();
  });

  it('supports forceDocument option', async () => {
    const call = jest.fn().mockResolvedValue(102);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const { send } = createControllers(sm, call, globalStore);

    await expect(send.sendFile('7', file, '', { forceDocument: true })).resolves.toEqual({
      ok: true,
      messageId: 102,
    });
    expect(call).toHaveBeenCalledWith(
      'message.sendMedia',
      [
        '7',
        expect.objectContaining({ name: 'photo.jpg' }),
        '',
        undefined,
        undefined,
        undefined,
        true,
      ],
      expect.anything(),
    );
  });
});

describe('MessageSendController.sendMediaGroup', () => {
  const file1 = {
    name: 'photo1.jpg',
    type: 'image/jpeg',
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
  } as unknown as File;

  const file2 = {
    name: 'video2.mp4',
    type: 'video/mp4',
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(16)),
  } as unknown as File;

  it('optimistically inserts mock messages, streams progress, and resolves', async () => {
    async function* mockStream() {
      yield { stage: 'uploading', uploadId: 'test_id', progress: 0.5 };
      yield { stage: 'done', messageIds: [301, 302] };
    }
    const stream = jest.fn().mockReturnValue(mockStream());
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const worker = { call, stream } as any;
    const load = { jumpToBottom: jest.fn().mockResolvedValue(undefined) } as any;
    const draft = {
      overlappingSave: jest.fn().mockReturnValue(Promise.resolve()),
      clearAfterSend: jest.fn().mockResolvedValue(undefined),
    } as any;
    const send = new MessageSendController({
      worker,
      sm,
      globalStore,
      drafts: draft,
      jumpToBottom: (peerId, threadId) => load.jumpToBottom(peerId, threadId),
    });

    const result = await send.sendMediaGroup(
      '7',
      [
        { file: file1, spoiler: true },
        { file: file2 },
      ],
      { caption: 'Album caption' },
    );

    expect(result).toEqual({ ok: true, messageId: 301 });
    expect(stream).toHaveBeenCalledWith(
      'message.sendMultiMediaProgress',
      [
        expect.objectContaining({
          peerId: '7',
          message: 'Album caption',
          items: expect.arrayContaining([
            expect.objectContaining({ spoiler: true }),
            expect.objectContaining({ file: expect.any(Object) }),
          ]),
        }),
      ],
      expect.objectContaining({ transfer: expect.any(Array) }),
    );
    expect(draft.clearAfterSend).toHaveBeenCalled();
  });

  it('supports aborting an individual item independently', async () => {
    async function* mockStream() {
      yield { stage: 'uploading', uploadId: 'u2', progress: 0.5 };
      yield { stage: 'done', messageIds: [302] };
    }
    const stream = jest.fn().mockReturnValue(mockStream());
    const call = jest.fn();
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const worker = { call, stream } as any;
    const load = { jumpToBottom: jest.fn().mockResolvedValue(undefined) } as any;
    const draft = {
      overlappingSave: jest.fn().mockReturnValue(Promise.resolve()),
      clearAfterSend: jest.fn().mockResolvedValue(undefined),
    } as any;
    const send = new MessageSendController({
      worker,
      sm,
      globalStore,
      drafts: draft,
      jumpToBottom: (peerId, threadId) => load.jumpToBottom(peerId, threadId),
    });

    const abortController1 = new AbortController();
    abortController1.abort();

    const result = await send.sendMediaGroup(
      '7',
      [
        { file: file1, abortSignal: abortController1.signal, uploadId: 'u1' },
        { file: file2, uploadId: 'u2' },
      ],
      { caption: 'Remaining caption' },
    );

    expect(result).toEqual({ ok: true, messageId: 302 });
    expect(stream).toHaveBeenCalledWith(
      'message.sendMultiMediaProgress',
      [
        expect.objectContaining({
          peerId: '7',
          message: 'Remaining caption',
          items: [
            expect.objectContaining({
              uploadId: 'u2',
            }),
          ],
        }),
      ],
      expect.objectContaining({ transfer: expect.any(Array) }),
    );
  });
});

describe('MessageDraftController.setDraft', () => {
  const CHANNEL_ID = '-1000000000009';

  function entityStore<M extends EntityWithId, E extends Entity>(model: new (data: E) => M) {
    return new EntityStore<M, E>({
      model,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('writes the thread draft and aligns the reply target', () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    draft.setReplyingTo('7', '9');

    draft.setDraft('7', { text: 'hello' });

    const thread = globalStore.getThreadUI('7');
    expect(thread?.draft).toEqual({ text: 'hello', replyToMsgId: '9' });
    expect(thread?.replyingToId).toBe('9');
    expect(thread?.toSnapshot().draft).toEqual({ text: 'hello', replyToMsgId: '9' });
    expect(call).not.toHaveBeenCalled();
  });

  it('keeps a reply that was not part of the draft when the draft is cleared', () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    draft.setReplyingTo('7', '4');

    draft.setDraft('7', undefined);

    expect(globalStore.getThreadUI('7')?.draft).toBeUndefined();
    expect(globalStore.getThreadUI('7')?.replyingToId).toBe('4');
  });

  it('clears the reply when it was stored on the draft', () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    draft.setDraft('7', { text: 'hello', replyToMsgId: '4' });

    draft.setDraft('7', undefined);

    expect(globalStore.getThreadUI('7')?.draft).toBeUndefined();
    expect(globalStore.getThreadUI('7')?.replyingToId).toBeUndefined();
  });

  it('debounces one saveDraft for the latest text and access hash', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const channelStore = entityStore<Channel, ChannelEntity>(Channel);
    channelStore.update([
      new Channel({
        id: CHANNEL_ID,
        accessHash: 'chan-hash',
        title: 'News',
        status: 'active',
      }),
    ]);
    sm.set('channel', channelStore);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);

    draft.setDraft(CHANNEL_ID, { text: 'h' });
    draft.setDraft(CHANNEL_ID, { text: 'hi', replyToMsgId: '12' });
    expect(call).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(SAVE_DRAFT_DEBOUNCE_MS);

    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith('message.saveDraft', [CHANNEL_ID, 'hi', 'chan-hash', 12]);

    call.mockClear();
    draft.setDraft(CHANNEL_ID, {
      text: '😁',
      entities: [
        {
          className: 'MessageEntityCustomEmoji',
          offset: 0,
          length: 2,
          documentId: '99',
        },
      ],
    });
    await jest.advanceTimersByTimeAsync(SAVE_DRAFT_DEBOUNCE_MS);
    expect(call).toHaveBeenCalledWith('message.saveDraft', [
      CHANNEL_ID,
      '😁',
      'chan-hash',
      12,
      [{ offset: 0, length: 2, documentId: '99' }],
    ]);
  });

  it('saves an empty draft when the composer is cleared', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    draft.setDraft('7', { text: 'hi' });
    draft.setDraft('7', undefined);

    await jest.advanceTimersByTimeAsync(SAVE_DRAFT_DEBOUNCE_MS);

    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith('message.saveDraft', ['7', '', undefined, undefined]);
  });

  it('updates the stored reply when the reply target changes', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    draft.setDraft('7', { text: 'hi', replyToMsgId: '4' });
    draft.setReplyingTo('7', undefined);

    expect(globalStore.getThreadUI('7')?.draft).toEqual({ text: 'hi' });
    await jest.advanceTimersByTimeAsync(SAVE_DRAFT_DEBOUNCE_MS);
    expect(call).toHaveBeenCalledWith('message.saveDraft', ['7', 'hi', undefined, undefined]);
  });

  it('drops a pending save when send succeeds', async () => {
    const call = jest.fn().mockResolvedValue(21);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    draft.setDraft('7', { text: 'hello' });

    await expect(send.sendText('7', 'hello')).resolves.toEqual({ ok: true, messageId: 21 });
    await jest.advanceTimersByTimeAsync(SAVE_DRAFT_DEBOUNCE_MS);

    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith('message.sendMessage', [
      '7',
      'hello',
      undefined,
      undefined,
      undefined,
    ]);
    expect(globalStore.getThreadUI('7')?.draft).toBeUndefined();
    expect(globalStore.getThreadUI('7')?.replyingToId).toBeUndefined();
  });

  it('keeps the draft when send fails', async () => {
    const call = jest.fn().mockImplementation((method: string) => {
      if (method === 'message.sendMessage') return Promise.reject(new Error('rpc'));
      return Promise.resolve(undefined);
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    draft.setDraft('7', { text: 'hello' });

    await expect(send.sendText('7', 'hello')).resolves.toEqual({ ok: false });
    expect(globalStore.getThreadUI('7')?.draft).toEqual({ text: 'hello' });

    await jest.advanceTimersByTimeAsync(SAVE_DRAFT_DEBOUNCE_MS);
    expect(call).toHaveBeenCalledWith('message.saveDraft', ['7', 'hello', undefined, undefined]);
  });

  it('clears a saveDraft that was already in flight when send succeeds', async () => {
    let releaseSave: () => void = () => {};
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const call = jest.fn().mockImplementation((method: string) => {
      if (method === 'message.saveDraft') return saveGate;
      return Promise.resolve(21);
    });
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);
    draft.setDraft('7', { text: 'hello' });
    await jest.advanceTimersByTimeAsync(SAVE_DRAFT_DEBOUNCE_MS);
    expect(call).toHaveBeenCalledTimes(1);

    const pending = send.sendText('7', 'hello');
    releaseSave();
    await pending;

    expect(call.mock.calls.filter(([method]) => method === 'message.saveDraft')).toEqual([
      ['message.saveDraft', ['7', 'hello', undefined, undefined]],
      ['message.saveDraft', ['7', '', undefined, undefined]],
    ]);
    expect(globalStore.getThreadUI('7')?.draft).toBeUndefined();
  });

  it('adopts the dialog draft only when the thread draft is empty', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = entityStore<Dialog, DialogEntity>(Dialog);
    dialogStore.update([
      createDialog({
        draft: {
          message: 'from server',
          date: 5,
          replyTo: { replyToMsgId: 4 },
        },
      }),
    ]);
    sm.set('dialog', dialogStore);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);

    draft.adoptDialogDraft('7');
    expect(globalStore.getThreadUI('7')?.draft).toEqual({
      text: 'from server',
      replyToMsgId: '4',
    });
    expect(globalStore.getThreadUI('7')?.replyingToId).toBe('4');

    draft.setDraft('7', { text: 'local' });
    draft.adoptDialogDraft('7');
    expect(globalStore.getThreadUI('7')?.draft).toEqual({ text: 'local', replyToMsgId: '4' });
    expect(dialogStore.getAllData().get('7')?.draftText).toBe('local');

    draft.setDraft('7', undefined);
    draft.adoptDialogDraft('7');
    expect(globalStore.getThreadUI('7')?.draft).toBeUndefined();

    await jest.advanceTimersByTimeAsync(SAVE_DRAFT_DEBOUNCE_MS);
    call.mockClear();
    draft.adoptDialogDraft('7');
    await jest.advanceTimersByTimeAsync(SAVE_DRAFT_DEBOUNCE_MS);
    expect(call).not.toHaveBeenCalled();
    expect(globalStore.getThreadUI('7')?.draft).toBeUndefined();
    expect(dialogStore.getAllData().get('7')?.draftText).toBeUndefined();
  });

  it('updates this dialog draft and leaves drafts on other dialogs alone', () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const dialogStore = entityStore<Dialog, DialogEntity>(Dialog);
    dialogStore.update([
      createDialog({
        draft: { message: 'keep me', date: 3, entities: [] },
      }),
      createDialog({ id: '8', peerId: '8' }),
    ]);
    sm.set('dialog', dialogStore);
    const { load: controller, read, send, draft } = createControllers(sm, call, globalStore);

    draft.setDraft('8', { text: 'hello', replyToMsgId: '4' });

    expect(dialogStore.getAllData().get('8')?.draft).toEqual(
      expect.objectContaining({
        message: 'hello',
        replyTo: { replyToMsgId: 4 },
      }),
    );
    expect(dialogStore.getAllData().get('7')?.draftText).toBe('keep me');
    expect(globalStore.getThreadUI('8')?.draft).toEqual({ text: 'hello', replyToMsgId: '4' });

    draft.setDraft('8', undefined);
    expect(dialogStore.getAllData().get('8')?.draftText).toBeUndefined();
    expect(dialogStore.getAllData().get('7')?.draftText).toBe('keep me');
  });
});
