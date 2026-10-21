import { EntityDataProvider } from '../../store/entity/entity.data-provider';
import EntityStore from '../../store/entity/entity.store';
import { Chat } from '../../store/entity/models/chat.model';
import { ChatFull } from '../../store/entity/models/chat-full.model';
import { Dialog } from '../../store/entity/models/dialog.model';
import { Message } from '../../store/entity/models/message.model';
import { User } from '../../store/entity/models/user.model';
import { GlobalStore } from '../../store';
import StoreManager from '../../store/store.manager';
import type { ChatEntity, ChatFullEntity, MessageEntity, UserEntity } from '../../store/types';
import { MODEL_TYPE } from '../../store/types';
import { MessageReactionController } from './message-reaction.controller';

function createController(sm: StoreManager, call: jest.Mock) {
  const globalStore = new GlobalStore(sm);
  return new MessageReactionController({
    sm,
    globalStore,
    worker: { call } as never,
    ensureMessageStore: (peerId) => sm.get(`${peerId}-message`) as never,
    loadMessagesByIds: async () => [],
    focusMessage: async () => undefined,
  });
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

describe('MessageReactionController.toggleReaction', () => {
  function setup(call: jest.Mock) {
    const sm = new StoreManager();
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
    userStore.update([{ id: '1', self: true } as UserEntity]);
    sm.set('user', userStore);
    return { controller: createController(sm, call), messageStore };
  }

  it('returns suggested emojis for private chats without fetching chat full', async () => {
    const call = jest.fn();
    const { controller } = setup(call);
    await expect(controller.getReactionMenuEmojis('123456789')).resolves.toEqual([
      '👍',
      '❤',
      '🔥',
      '🎉',
      '😢',
      '😮',
    ]);
    expect(call).not.toHaveBeenCalled();
  });

  it('returns only allow-listed emojis when the chat uses a fixed reaction set', async () => {
    const groupPeerId = '-10';
    const call = jest.fn();
    const sm = new StoreManager();
    sm.set(
      `${groupPeerId}-message`,
      new EntityStore<Message, MessageEntity>({
        model: Message,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );
    const chatFullStore = new EntityStore<ChatFull, ChatFullEntity>({
      model: ChatFull,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    chatFullStore.update([
      {
        id: groupPeerId,
        about: '',
        participants: { participants: [] },
        notifySettings: {},
        availableReactions: { reactions: [{ emoticon: '🔥' }, { emoticon: '❤' }] },
      } as ChatFullEntity,
    ]);
    sm.set('chatFull', chatFullStore);
    const controller = createController(sm, call);

    await expect(controller.getReactionMenuEmojis(groupPeerId)).resolves.toEqual(['🔥', '❤']);
    expect(call).not.toHaveBeenCalled();
  });

  it('fetches chat full when group reaction policy is not loaded yet', async () => {
    const groupPeerId = '-10';
    const call = jest.fn().mockResolvedValue({
      fullChats: {},
      chats: {},
      channels: {},
      users: {},
    });
    const sm = new StoreManager();
    sm.set(
      `${groupPeerId}-message`,
      new EntityStore<Message, MessageEntity>({
        model: Message,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );
    const chatFullStore = new EntityStore<ChatFull, ChatFullEntity>({
      model: ChatFull,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('chatFull', chatFullStore);
    chatFullStore.get(groupPeerId);
    const controller = createController(sm, call);

    await controller.getReactionMenuEmojis(groupPeerId);

    expect(call).toHaveBeenCalledWith('chat.getFullChatByIds', [[groupPeerId]]);
  });

  it('sends the toggled reaction without mutating the local store', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const { controller, messageStore } = setup(call);
    messageStore.update([createMessageEntity('12', '7')]);

    await controller.toggleReaction({
      peerId: '7',
      messageId: '12',
      reaction: { emoticon: '👍' },
    });

    expect(messageStore.get('12')?.reactions).toBeUndefined();
    expect(call).toHaveBeenCalledWith('message.sendReaction', [
      '7',
      12,
      [{ emoticon: '👍' }],
      undefined,
      undefined,
    ]);
  });

  it('leaves reactions unchanged when the send fails', async () => {
    const call = jest.fn().mockRejectedValue(new Error('fail'));
    const { controller, messageStore } = setup(call);
    const previous = {
      min: false,
      canSeeList: false,
      reactionsAsTags: false,
      results: [{ reaction: { emoticon: '🔥' }, count: 1, chosenOrder: 0 }],
    };
    messageStore.update([{ ...createMessageEntity('12', '7'), reactions: previous }]);

    await controller.toggleReaction({
      peerId: '7',
      messageId: '12',
      reaction: { emoticon: '👍' },
    });

    expect(messageStore.get('12')?.reactions?.results).toEqual(previous.results);
  });

  it('keeps a paid row, drops it from the request, and uses the given message id', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const { controller, messageStore } = setup(call);
    messageStore.update([
      {
        ...createMessageEntity('20', '7'),
        reactions: {
          min: false,
          canSeeList: false,
          reactionsAsTags: false,
          results: [
            { reaction: { paid: true }, count: 2 },
            { reaction: { emoticon: '❤' }, count: 1, chosenOrder: 0 },
          ],
        },
      },
    ]);

    await controller.toggleReaction({
      peerId: '7',
      messageId: '20',
      reaction: { emoticon: '👍' },
    });

    expect(messageStore.get('20')?.reactions?.results).toEqual([
      { reaction: { paid: true }, count: 2 },
      { reaction: { emoticon: '❤' }, count: 1, chosenOrder: 0 },
    ]);
    expect(call).toHaveBeenCalledWith('message.sendReaction', [
      '7',
      20,
      [{ emoticon: '👍' }],
      undefined,
      undefined,
    ]);
  });

  it('allows toggling a reaction already on the message when chat policy is none', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const groupPeerId = '-10';
    const sm = new StoreManager();
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set(`${groupPeerId}-message`, messageStore);
    const chatFullStore = new EntityStore<ChatFull, ChatFullEntity>({
      model: ChatFull,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    chatFullStore.update([
      {
        id: groupPeerId,
        availableReactions: {},
        about: '',
        participants: { participants: [] },
        notifySettings: {},
      } as ChatFullEntity,
    ]);
    sm.set('chatFull', chatFullStore);
    const userStore = new EntityStore<User, UserEntity>({
      model: User,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    userStore.update([{ id: '1', self: true } as UserEntity]);
    sm.set('user', userStore);
    const controller = createController(sm, call);
    messageStore.update([
      {
        ...createMessageEntity('12', groupPeerId),
        peerType: 'group',
        reactions: {
          min: false,
          canSeeList: false,
          reactionsAsTags: false,
          results: [{ reaction: { emoticon: '🔥' }, count: 2 }],
        },
      },
    ]);

    await controller.toggleReaction({
      peerId: groupPeerId,
      messageId: '12',
      reaction: { emoticon: '🔥' },
    });

    expect(call).toHaveBeenCalledWith('message.sendReaction', [
      groupPeerId,
      12,
      [{ emoticon: '🔥' }],
      undefined,
      undefined,
    ]);
  });

  it('clears a positive unread count when GetUnreadReactions returns no messages', async () => {
    const call = jest.fn().mockResolvedValue({ messageIds: [] });
    const sm = new StoreManager();
    const dialogStore = new EntityStore<Dialog, import('../../store/types').DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('dialog', dialogStore);
    dialogStore.update([
      {
        id: '7',
        peerId: '7',
        topMessageId: '1',
        unreadCount: 0,
        unreadReactionsCount: 2,
        isFolder: false,
      },
    ]);
    const controller = createController(sm, call);
    await controller.fetchUnreadReactions('7');
    expect(dialogStore.get('7')?.unreadReactionsCount).toBeUndefined();
    expect(call).toHaveBeenCalledWith('message.getUnreadReactions', ['7']);
  });

  it('keeps a live unread reaction when GetUnreadReactions returns no messages', async () => {
    const call = jest.fn().mockResolvedValue({ messageIds: [] });
    const sm = new StoreManager();
    const dialogStore = new EntityStore<Dialog, import('../../store/types').DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('dialog', dialogStore);
    dialogStore.update([
      {
        id: '7',
        peerId: '7',
        topMessageId: '1',
        unreadCount: 0,
        unreadReactionsCount: 1,
        isFolder: false,
      },
    ]);
    const globalStore = new GlobalStore(sm);
    globalStore.getOrCreateDialogUI('7').setUnreadReactionIds(['5']);
    const controller = new MessageReactionController({
      sm,
      globalStore,
      worker: { call } as never,
      ensureMessageStore: (peerId) => sm.get(`${peerId}-message`) as never,
      loadMessagesByIds: async () => [],
      focusMessage: async () => undefined,
    });
    await controller.fetchUnreadReactions('7');
    expect(dialogStore.get('7')?.unreadReactionsCount).toBe(1);
    expect(globalStore.getDialogUI('7')?.unreadReactionIds).toEqual(['5']);
  });

  it('drops an opened reaction when the server still lists it', async () => {
    const call = jest.fn().mockResolvedValue({ messageIds: ['5', '6'] });
    const sm = new StoreManager();
    const dialogStore = new EntityStore<Dialog, import('../../store/types').DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('dialog', dialogStore);
    sm.set(
      '7-message',
      new EntityStore<Message, MessageEntity>({
        model: Message,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );
    dialogStore.update([
      {
        id: '7',
        peerId: '7',
        topMessageId: '1',
        unreadCount: 0,
        unreadReactionsCount: 1,
        isFolder: false,
      },
    ]);
    const globalStore = new GlobalStore(sm);
    globalStore.getOrCreateDialogUI('7').setUnreadReactionIds(['6']);
    globalStore.getOrCreateDialogUI('7').markReactionsSeen(['5']);
    const controller = new MessageReactionController({
      sm,
      globalStore,
      worker: { call } as never,
      ensureMessageStore: (peerId) => sm.get(`${peerId}-message`) as never,
      loadMessagesByIds: async () => [],
      focusMessage: async () => undefined,
    });
    await controller.fetchUnreadReactions('7');
    expect(globalStore.getDialogUI('7')?.unreadReactionIds).toEqual(['6']);
    expect(dialogStore.get('7')?.unreadReactionsCount).toBe(1);
  });

  it('marks the opened reaction read so the next one starts at 1', async () => {
    const call = jest.fn().mockResolvedValue({ messageIds: [] });
    const sm = new StoreManager();
    const dialogStore = new EntityStore<Dialog, import('../../store/types').DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('dialog', dialogStore);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([createMessageEntity('5', '7', true)]);
    sm.set('7-message', messageStore);
    dialogStore.update([
      {
        id: '7',
        peerId: '7',
        topMessageId: '5',
        unreadCount: 0,
        unreadReactionsCount: 1,
        isFolder: false,
      },
    ]);
    const globalStore = new GlobalStore(sm);
    globalStore.getOrCreateDialogUI('7').setUnreadReactionIds(['5']);
    const controller = new MessageReactionController({
      sm,
      globalStore,
      worker: { call } as never,
      ensureMessageStore: (peerId) => sm.get(`${peerId}-message`) as never,
      loadMessagesByIds: async () => [],
      focusMessage: async () => undefined,
    });
    await controller.focusClosestUnreadReaction('7');
    expect(globalStore.getDialogUI('7')?.unreadReactionIds).toEqual([]);
    expect(globalStore.getOrCreateDialogUI('7').hasSeenReaction('5')).toBe(true);
    expect(dialogStore.get('7')?.unreadReactionsCount).toBeUndefined();
    expect(call).toHaveBeenCalledWith('message.readAllReactions', ['7']);
  });

  it('reads only the reaction message on screen and keeps the others', async () => {
    const call = jest.fn().mockResolvedValue({ messageIds: [] });
    const sm = new StoreManager();
    const dialogStore = new EntityStore<Dialog, import('../../store/types').DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('dialog', dialogStore);
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    messageStore.update([createMessageEntity('5', '7', true), createMessageEntity('6', '7', true)]);
    sm.set('7-message', messageStore);
    dialogStore.update([
      {
        id: '7',
        peerId: '7',
        topMessageId: '6',
        unreadCount: 0,
        unreadReactionsCount: 2,
        isFolder: false,
      },
    ]);
    const globalStore = new GlobalStore(sm);
    globalStore.getOrCreateDialogUI('7').setUnreadReactionIds(['5', '6']);
    const controller = new MessageReactionController({
      sm,
      globalStore,
      worker: { call } as never,
      ensureMessageStore: (peerId) => sm.get(`${peerId}-message`) as never,
      loadMessagesByIds: async () => [],
      focusMessage: async () => undefined,
    });

    controller.markReactionsRead('7', ['5', '9']);

    expect(globalStore.getDialogUI('7')?.unreadReactionIds).toEqual(['6']);
    expect(globalStore.getOrCreateDialogUI('7').hasSeenReaction('5')).toBe(true);
    expect(dialogStore.get('7')?.unreadReactionsCount).toBe(1);
    expect(call).not.toHaveBeenCalledWith('message.readAllReactions', ['7']);

    controller.markReactionsRead('7', ['6']);

    expect(globalStore.getDialogUI('7')?.unreadReactionIds).toEqual([]);
    expect(dialogStore.get('7')?.unreadReactionsCount).toBeUndefined();
    expect(call).toHaveBeenCalledWith('message.readAllReactions', ['7']);
  });

  it('setDefaultReaction updates the worker and local cache', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const { controller } = setup(call);
    await controller.setDefaultReaction({ emoticon: '🔥' });
    expect(call).toHaveBeenCalledWith('message.setDefaultReaction', ['🔥']);
    await expect(controller.getDefaultReaction()).resolves.toBe('🔥');
  });

  it('lists a reaction with the message text and dialog title', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
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
    userStore.update([{ id: '7', firstName: 'Ada' } as UserEntity]);
    sm.set('user', userStore);
    messageStore.update([
      {
        ...createMessageEntity('5', '7'),
        message: 'hello there',
        reactions: {
          results: [{ reaction: { emoticon: '🔥' }, count: 1 }],
          recentReactions: [
            {
              peerId: { userId: '1' },
              date: 1_700_000_100,
              reaction: { emoticon: '🔥' },
            },
          ],
        },
      } as MessageEntity,
    ]);
    const controller = createController(sm, call);
    await expect(controller.listRecentReactionMessages()).resolves.toEqual([
      expect.objectContaining({
        emoticon: '🔥',
        messageText: 'hello there',
        dialogTitle: 'Ada',
        peerId: '7',
        messageId: '5',
      }),
    ]);
    expect(call).not.toHaveBeenCalled();
  });

  it('uses the group title when a user stub shares the chat id', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const peerId = '-10';
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set(`${peerId}-message`, messageStore);
    const userStore = new EntityStore<User, UserEntity>({
      model: User,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    userStore.update([{ id: peerId } as UserEntity]);
    sm.set('user', userStore);
    const chatStore = new EntityStore<Chat, ChatEntity>({
      model: Chat,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    chatStore.update([{ id: peerId, title: 'Design', status: 'active' }]);
    sm.set('chat', chatStore);
    messageStore.update([
      {
        ...createMessageEntity('5', peerId),
        message: 'hello there',
        reactions: {
          results: [{ reaction: { emoticon: '❤' }, count: 1 }],
        },
      } as MessageEntity,
    ]);
    const controller = createController(sm, call);
    await expect(controller.listRecentReactionMessages()).resolves.toEqual([
      expect.objectContaining({
        dialogTitle: 'Design',
        messageText: 'hello there',
        peerId,
      }),
    ]);
  });

  it('skips a message whose reaction payload has no results array', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    messageStore.update([
      {
        ...createMessageEntity('5', '7'),
        message: 'hello there',
        reactions: { recentReactions: [{ date: 1, reaction: undefined }] },
      } as MessageEntity,
      {
        ...createMessageEntity('6', '7'),
        message: 'still here',
        reactions: {
          results: [{ reaction: { emoticon: '❤' }, count: 1 }],
        },
      } as MessageEntity,
    ]);
    const controller = createController(sm, call);
    const rows = await controller.listRecentReactionMessages();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toEqual([
      expect.objectContaining({ messageId: '6', emoticon: '❤', messageText: 'still here' }),
    ]);
  });

  it('loads the reaction time instead of the message send time', async () => {
    const call = jest.fn(async (method: string) => {
      if (method === 'message.getMessageReactionsList') {
        return {
          count: 1,
          reactions: [
            {
              peerId: { userId: '1' },
              date: 1_600_000_000,
              reaction: { emoticon: '❤' },
            },
          ],
        };
      }
      return undefined;
    });
    const sm = new StoreManager();
    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set('7-message', messageStore);
    messageStore.update([
      {
        ...createMessageEntity('5', '7'),
        message: 'hello there',
        reactions: {
          results: [{ reaction: { emoticon: '❤' }, count: 1 }],
        },
      } as MessageEntity,
    ]);
    const controller = createController(sm, call);
    const rows = await controller.listRecentReactionMessages();
    expect(rows[0]?.date).toBe(1_600_000_000);
    expect(rows[0]?.date).not.toBe(1_700_000_005);
  });

  it('ignores non-positive message ids', async () => {
    const call = jest.fn();
    const { controller, messageStore } = setup(call);
    messageStore.update([createMessageEntity('0', '7')]);
    await controller.toggleReaction({
      peerId: '7',
      messageId: 0,
      reaction: { emoticon: '👍' },
    });
    expect(call).not.toHaveBeenCalled();
  });
});
