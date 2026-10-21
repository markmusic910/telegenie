import { UpdatesController } from './updates.controller';
import type { StoreSyncPayload } from '@telegenie/libs/foundation/telegram/worker';
import EntityStore from '../../store/entity/entity.store';
import { Dialog } from '../../store/entity/models/dialog.model';
import { Message } from '../../store/entity/models/message.model';
import { User } from '../../store/entity/models/user.model';
import { EntityDataProvider } from '../../store/entity/entity.data-provider';
import StoreManager from '../../store/store.manager';
import { GlobalStore } from '../../store';
import {
  MODEL_TYPE,
  type DialogEntity,
  type MessageEntity,
  type MessageStore,
  type UserEntity,
} from '../../store/types';
function putNew(
  peerId: string,
  id: number,
  extras: {
    out?: boolean;
    date?: number;
    message?: string;
    mentioned?: boolean;
    media_unread?: boolean;
  } = {},
): StoreSyncPayload {
  return {
    type: 'message.put',
    op: 'new',
    messages: [
      {
        id,
        date: extras.date ?? 100,
        message: extras.message ?? 'hello',
        peer_id: { userId: peerId },
        out: extras.out,
        mentioned: extras.mentioned,
        media_unread: extras.media_unread,
      },
    ],
    messageServices: [],
    emptyMessages: [],
  };
}

function createModule(markMessageListRead?: (peerId: string, maxId: number) => void) {
  const sm = new StoreManager();
  sm.set(
    'dialog',
    new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    }),
  );
  const ensureMessageStore = (peerId: string): MessageStore => {
    const name = `${peerId}-message`;
    if (sm.has(name)) return sm.get(name) as MessageStore;
    const store = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    sm.set(name, store);
    return store;
  };
  const globalStore = new GlobalStore(sm);
  return {
    sm,
    globalStore,
    updates: new UpdatesController({ sm, ensureMessageStore, globalStore, markMessageListRead }),
    ensureMessageStore,
  };
}

describe('UpdatesController', () => {
  it('writes a new incoming message into the message store and creates a dialog', () => {
    const { sm, updates, ensureMessageStore } = createModule();
    updates.apply(putNew('7', 5, { message: 'hi' }));

    const message = ensureMessageStore('7').getAllData().get('5');
    expect(message?.message).toBe('hi');

    const dialog = sm.get('dialog').getAllData().get('7');
    expect(dialog?.topMessageId).toBe('5');
    expect(dialog?.unreadCount).toBe(1);
  });

  it('increments unreadMentionsCount and caches mention id for incoming mentions', () => {
    const { sm, updates, globalStore } = createModule();
    updates.apply(
      putNew('7', 5, {
        message: '@you hello',
        mentioned: true,
        media_unread: true,
      }),
    );

    const dialog = sm.get('dialog').getAllData().get('7');
    expect(dialog?.unreadMentionsCount).toBe(1);
    expect(globalStore.getDialogUI('7')?.unreadMentionIds).toEqual(['5']);
  });

  it('does not increment unread for outgoing messages and bumps topMessageId', () => {
    const { sm, updates } = createModule();
    updates.apply(putNew('7', 1, { out: false }));
    updates.apply(putNew('7', 2, { out: true }));

    const dialog = sm.get('dialog').getAllData().get('7');
    expect(dialog?.topMessageId).toBe('2');
    expect(dialog?.unreadCount).toBe(1);
  });

  it('applies inbox read without clobbering topMessageId', () => {
    const { sm, updates } = createModule();
    updates.apply(putNew('7', 9));
    updates.apply({
      type: 'read.inbox',
      peerId: '7',
      maxId: 9,
      stillUnreadCount: 0,
    });

    const dialog = sm.get('dialog').getAllData().get('7');
    expect(dialog?.unreadCount).toBe(0);
    expect(dialog?.readInboxMaxId).toBe(9);
    expect(dialog?.topMessageId).toBe('9');
  });

  it('replaces sortedDialogIds on the nav slice', () => {
    const global = new GlobalStore();
    global.nav.setSortedDialogIds(['a']);
    global.nav.setSortedDialogIds(['b', 'c']);
    expect(global.nav.sortedDialogIds).toEqual(['b', 'c']);
    global.hydrateAppSnapshot({ sortedDialogIds: ['x', 'y'] });
    expect(global.nav.sortedDialogIds).toEqual(['x', 'y']);
  });

  it('appends a live message onto the listed window', () => {
    const { updates, globalStore, ensureMessageStore } = createModule();
    updates.apply(putNew('7', 5));
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['5']);
    updates.apply(putNew('7', 6));
    expect(globalStore.getThreadUI('7')?.listedIds).toEqual(['5', '6']);
    expect(globalStore.getThreadUI('7')?.msgIndexes.cachedIds).toEqual([5, 6]);
    expect(ensureMessageStore('7').getAllData().has('6')).toBe(true);
  });

  it('does not list a live message while the listed window is historical', () => {
    const { updates, globalStore } = createModule();
    updates.apply(putNew('7', 5));
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['5']);
    updates.apply(putNew('7', 10));
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['5']);
    expect(globalStore.getThreadUI('7')?.listedFollowsNewest).toBe(false);
    updates.apply(putNew('7', 11));
    expect(globalStore.getThreadUI('7')?.listedIds).toEqual(['5']);
    expect(globalStore.getThreadUI('7')?.pendingNewerCount).toBe(1);
    expect(globalStore.getThreadUI('7')?.msgIndexes.cachedIds).toEqual([5, 10, 11]);
  });

  it('appends the first live message after an empty thread has loaded', () => {
    const { updates, globalStore } = createModule();
    globalStore.getOrCreateThreadUI('7').setHistoryState({ historyLoaded: true });
    updates.apply(putNew('7', 1));
    expect(globalStore.getThreadUI('7')?.listedIds).toEqual(['1']);
  });

  it('deletes messages and rolls topMessageId back', () => {
    const { sm, updates, ensureMessageStore, globalStore } = createModule();
    updates.apply(putNew('7', 1));
    updates.apply(putNew('7', 2, { out: true }));
    updates.apply({ type: 'message.delete', peerId: '7', ids: [2] });

    expect(ensureMessageStore('7').getAllData().has('2')).toBe(false);
    expect(sm.get('dialog').getAllData().get('7')?.topMessageId).toBe('1');
    expect(globalStore.getThreadUI('7')?.msgIndexes.deletedIds).toContain(2);
    expect(globalStore.getThreadUI('7')?.msgIndexes.cachedIds).not.toContain(2);
  });

  it('tracks unread reactions on outgoing message reaction patches', () => {
    const { sm, updates, ensureMessageStore, globalStore } = createModule();
    sm.set(
      'user',
      new EntityStore<User, UserEntity>({
        model: User,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );
    sm.get('user').update([{ id: '1', self: true } as UserEntity]);
    updates.apply(putNew('7', 5, { out: true, message: 'mine' }));
    const unreadReaction = {
      min: false,
      canSeeList: false,
      reactionsAsTags: false,
      results: [{ reaction: { emoticon: '👍' }, count: 1 }],
      recentReactions: [
        {
          unread: true,
          my: false,
          date: 1,
          reaction: { emoticon: '👍' },
          peerId: { userId: '99' },
        },
      ],
    };
    updates.apply({
      type: 'message.patch',
      peerId: '7',
      patches: [{ id: 5, reactions: unreadReaction }],
    });
    expect(sm.get('dialog').getAllData().get('7')?.unreadReactionsCount).toBe(1);
    expect(globalStore.getDialogUI('7')?.unreadReactionIds).toEqual(['5']);

    const readReaction = {
      ...unreadReaction,
      recentReactions: [{ ...unreadReaction.recentReactions![0], unread: false }],
    };
    updates.apply({
      type: 'message.patch',
      peerId: '7',
      patches: [{ id: 5, reactions: readReaction }],
    });
    expect(globalStore.getDialogUI('7')?.unreadReactionIds).toEqual(['5']);
    expect(sm.get('dialog').getAllData().get('7')?.unreadReactionsCount).toBe(1);
    expect(ensureMessageStore('7').getAllData().get('5')?.reactions).toEqual(readReaction);

    updates.apply({
      type: 'message.patch',
      peerId: '7',
      patches: [
        {
          id: 5,
          reactions: {
            min: false,
            canSeeList: false,
            reactionsAsTags: false,
            results: [],
          },
        },
      ],
    });
    expect(globalStore.getDialogUI('7')?.unreadReactionIds).toEqual([]);
    expect(sm.get('dialog').getAllData().get('7')?.unreadReactionsCount).toBeUndefined();
  });

  it('shows the dialog reaction icon when the reacted message is not cached', () => {
    const { sm, updates, globalStore } = createModule();
    sm.set(
      'user',
      new EntityStore<User, UserEntity>({
        model: User,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );
    sm.get('user').update([{ id: '1', self: true } as UserEntity]);
    updates.apply({
      type: 'message.patch',
      peerId: '7',
      patches: [
        {
          id: 5,
          reactions: {
            min: false,
            canSeeList: false,
            reactionsAsTags: false,
            results: [{ reaction: { emoticon: '❤' }, count: 1 }],
            recentReactions: [
              {
                unread: true,
                my: false,
                date: 2,
                reaction: { emoticon: '❤' },
                peerId: { userId: '99' },
              },
            ],
          },
        },
      ],
    });
    expect(sm.get('dialog').getAllData().get('7')?.unreadReactionsCount).toBe(1);
    expect(globalStore.getDialogUI('7')?.unreadReactionIds).toEqual(['5']);
  });

  it('shows the dialog reaction icon when an outgoing message only has reaction counts', () => {
    const { sm, updates } = createModule();
    updates.apply(putNew('7', 5, { out: true, message: 'mine' }));
    updates.apply({
      type: 'message.patch',
      peerId: '7',
      patches: [
        {
          id: 5,
          reactions: {
            min: true,
            canSeeList: false,
            reactionsAsTags: false,
            results: [{ reaction: { emoticon: '🔥' }, count: 1 }],
          },
        },
      ],
    });
    expect(sm.get('dialog').getAllData().get('7')?.unreadReactionsCount).toBe(1);
  });

  it('shows the dialog reaction icon when a foreign reaction is not flagged unread', () => {
    const { sm, updates, globalStore } = createModule();
    updates.apply(putNew('7', 5, { out: true, message: 'mine' }));
    updates.apply({
      type: 'message.patch',
      peerId: '7',
      patches: [
        {
          id: 5,
          reactions: {
            min: false,
            canSeeList: false,
            reactionsAsTags: false,
            results: [{ reaction: { emoticon: '👍' }, count: 1 }],
            recentReactions: [
              {
                unread: false,
                my: false,
                date: 3,
                reaction: { emoticon: '👍' },
                peerId: { userId: '99' },
              },
            ],
          },
        },
      ],
    });
    expect(sm.get('dialog').getAllData().get('7')?.unreadReactionsCount).toBe(1);
    expect(globalStore.getDialogUI('7')?.unreadReactionIds).toEqual(['5']);
  });

  it('does not count a reaction again after it was opened', () => {
    const { sm, updates, globalStore } = createModule();
    updates.apply(putNew('7', 5, { out: true, message: 'mine' }));
    updates.apply(putNew('7', 6, { out: true, message: 'mine too' }));
    const reactionOn = (id: number, date: number) => ({
      type: 'message.patch' as const,
      peerId: '7',
      patches: [
        {
          id,
          reactions: {
            min: false,
            canSeeList: false,
            reactionsAsTags: false,
            results: [{ reaction: { emoticon: '👍' }, count: 1 }],
            recentReactions: [
              {
                unread: false,
                my: false,
                date,
                reaction: { emoticon: '👍' },
                peerId: { userId: '99' },
              },
            ],
          },
        },
      ],
    });
    updates.apply(reactionOn(5, 3));
    expect(sm.get('dialog').getAllData().get('7')?.unreadReactionsCount).toBe(1);

    globalStore.getOrCreateDialogUI('7').markReactionsSeen(['5']);
    globalStore.getOrCreateDialogUI('7').clearUnreadReactionIds();
    sm.get('dialog').update([
      {
        id: '7',
        peerId: '7',
        topMessageId: '6',
        unreadCount: 0,
        isFolder: false,
      },
    ]);
    updates.apply(reactionOn(5, 4));
    expect(sm.get('dialog').getAllData().get('7')?.unreadReactionsCount).toBeUndefined();

    updates.apply(reactionOn(6, 5));
    expect(sm.get('dialog').getAllData().get('7')?.unreadReactionsCount).toBe(1);
    expect(globalStore.getDialogUI('7')?.unreadReactionIds).toEqual(['6']);
  });

  it('does not badge the dialog for the user’s own reaction', () => {
    const { sm, updates } = createModule();
    updates.apply(putNew('7', 5, { out: true, message: 'mine' }));
    updates.apply({
      type: 'message.patch',
      peerId: '7',
      patches: [
        {
          id: 5,
          reactions: {
            min: false,
            canSeeList: false,
            reactionsAsTags: false,
            results: [{ reaction: { emoticon: '👍' }, count: 1, chosenOrder: 0 }],
            recentReactions: [
              {
                unread: false,
                my: true,
                date: 3,
                reaction: { emoticon: '👍' },
                peerId: { userId: '1' },
              },
            ],
          },
        },
      ],
    });
    expect(sm.get('dialog').getAllData().get('7')?.unreadReactionsCount).toBeUndefined();
  });

  it('shows the dialog reaction icon when an edited message gains a foreign reaction', () => {
    const { sm, updates, globalStore } = createModule();
    updates.apply(putNew('7', 5, { out: true, message: 'mine' }));
    updates.apply({
      type: 'message.put',
      op: 'edit',
      messages: [
        {
          id: 5,
          date: 100,
          message: 'mine',
          peer_id: { userId: '7' },
          out: true,
          reactions: {
            min: false,
            canSeeList: false,
            reactionsAsTags: false,
            results: [{ reaction: { emoticon: '🔥' }, count: 1 }],
            recentReactions: [
              {
                peerId: { userId: '99' },
                reaction: { emoticon: '🔥' },
                date: 4,
                unread: false,
                big: false,
                my: false,
              },
            ],
          },
        },
      ],
      messageServices: [],
      emptyMessages: [],
    });
    expect(sm.get('dialog').getAllData().get('7')?.unreadReactionsCount).toBe(1);
    expect(globalStore.getDialogUI('7')?.unreadReactionIds).toEqual(['5']);
  });

  it('does not badge a dialog when the reaction is on someone else’s message', () => {
    const { sm, updates } = createModule();
    updates.apply(putNew('7', 5, { out: false, message: 'theirs' }));
    updates.apply({
      type: 'message.patch',
      peerId: '7',
      patches: [
        {
          id: 5,
          reactions: {
            min: true,
            canSeeList: false,
            reactionsAsTags: false,
            results: [{ reaction: { emoticon: '🔥' }, count: 1 }],
          },
        },
      ],
    });
    expect(sm.get('dialog').getAllData().get('7')?.unreadReactionsCount).toBeUndefined();
  });

  it('patches reactions and skips an identical payload', () => {
    const { updates, ensureMessageStore } = createModule();
    updates.apply(putNew('7', 5, { message: 'hi' }));
    const reactions = {
      min: false,
      canSeeList: false,
      reactionsAsTags: false,
      results: [{ reaction: { emoticon: '👍' }, count: 1, chosenOrder: 0 }],
    };
    updates.apply({
      type: 'message.patch',
      peerId: '7',
      patches: [{ id: 5, reactions }],
    });
    expect(ensureMessageStore('7').getAllData().get('5')?.reactions).toEqual(reactions);
    expect(ensureMessageStore('7').getAllData().get('5')?.message).toBe('hi');

    const before = ensureMessageStore('7').getAllData().get('5');
    updates.apply({
      type: 'message.patch',
      peerId: '7',
      patches: [{ id: 5, reactions }],
    });
    expect(ensureMessageStore('7').getAllData().get('5')).toBe(before);

    updates.apply({
      type: 'message.patch',
      peerId: '7',
      patches: [{ id: 99, reactions }],
    });
    expect(ensureMessageStore('7').getAllData().has('99')).toBe(false);
  });

  it('patches message views and forwards without replacing the message body', () => {
    const { updates, ensureMessageStore } = createModule();
    updates.apply(putNew('7', 5, { message: 'hi' }));
    updates.apply({
      type: 'message.patch',
      peerId: '7',
      patches: [{ id: 5, forwards: 3, views: 10 }],
    });

    const message = ensureMessageStore('7').getAllData().get('5');
    expect(message?.message).toBe('hi');
    expect(message?.forwards).toBe(3);
    expect(message?.views).toBe(10);
  });

  it('marks the selected dialog read when an outgoing message arrives', () => {
    const markMessageListRead = jest.fn();
    const { updates, globalStore } = createModule(markMessageListRead);
    globalStore.nav.setSelectedDialogId('7');
    updates.apply(putNew('7', 12, { out: true }));
    expect(markMessageListRead).toHaveBeenCalledWith('7', 12);
  });

  it('does not mark read for outgoing messages in another dialog', () => {
    const markMessageListRead = jest.fn();
    const { updates, globalStore } = createModule(markMessageListRead);
    globalStore.nav.setSelectedDialogId('8');
    updates.apply(putNew('7', 12, { out: true }));
    expect(markMessageListRead).not.toHaveBeenCalled();
  });

  it('does not mark read for incoming messages in the selected dialog', () => {
    const markMessageListRead = jest.fn();
    const { updates, globalStore } = createModule(markMessageListRead);
    globalStore.nav.setSelectedDialogId('7');
    updates.apply(putNew('7', 12, { out: false }));
    expect(markMessageListRead).not.toHaveBeenCalled();
  });

  it('clears mediaUnread for a channel content read and drops the mention', () => {
    const { sm, updates, globalStore, ensureMessageStore } = createModule();
    const peerId = '-1009';
    ensureMessageStore(peerId).update([
      new Message({
        kind: 'message',
        id: '8',
        peerId,
        date: 1,
        message: 'voice',
        out: false,
        mentioned: true,
        mediaUnread: true,
        isEmpty: false,
      } as MessageEntity),
    ]);
    sm.get('dialog').update([
      new Dialog({
        id: peerId,
        peerId,
        topMessageId: '8',
        unreadCount: 1,
        unreadMentionsCount: 2,
        isFolder: false,
      } as DialogEntity),
    ]);
    globalStore.getOrCreateDialogUI(peerId).setUnreadMentionIds(['8', '9']);

    updates.apply({ type: 'read.contents', peerId, ids: [8] });

    const message = ensureMessageStore(peerId).getAllData().get('8');
    expect(message?.mediaUnread).toBe(false);
    expect(message?.hasUnreadMention).toBe(false);
    expect(globalStore.getDialogUI(peerId)?.unreadMentionIds).toEqual(['9']);
    expect(sm.get('dialog').getAllData().get(peerId)?.unreadMentionsCount).toBe(1);
  });

  it('clears a common-box content read by scanning message stores', () => {
    const { updates, ensureMessageStore } = createModule();
    updates.apply(putNew('7', 20, { media_unread: true }));
    updates.apply(putNew('8', 21, { media_unread: true }));

    updates.apply({ type: 'read.contents', ids: [20] });

    expect(ensureMessageStore('7').getAllData().get('20')?.mediaUnread).toBe(false);
    expect(ensureMessageStore('8').getAllData().get('21')?.mediaUnread).toBe(true);
  });

  it('ignores a stale inbox-read update behind the local cursor', () => {
    const { sm, updates } = createModule();
    updates.apply(putNew('7', 9, { out: false }));
    updates.apply({ type: 'read.inbox', peerId: '7', maxId: 9, stillUnreadCount: 0 });
    expect(sm.get('dialog').getAllData().get('7')?.unreadCount).toBe(0);
    expect(sm.get('dialog').getAllData().get('7')?.readInboxMaxId).toBe(9);

    updates.apply({ type: 'read.inbox', peerId: '7', maxId: 5, stillUnreadCount: 134 });
    expect(sm.get('dialog').getAllData().get('7')?.unreadCount).toBe(0);
    expect(sm.get('dialog').getAllData().get('7')?.readInboxMaxId).toBe(9);
  });

  it('does not move the unread divider from inbox read updates', () => {
    const { updates, globalStore } = createModule();
    updates.apply(putNew('7', 8, { out: false }));
    updates.apply(putNew('7', 9, { out: false }));
    globalStore.getOrCreateThreadUI('7').replaceListedWindow(['8', '9']);
    globalStore.getOrCreateThreadUI('7').freezeUnreadDivider();
    expect(globalStore.getThreadUI('7')?.unreadDividerId).toBe('8');

    updates.apply({ type: 'read.inbox', peerId: '7', maxId: 8, stillUnreadCount: 1 });
    expect(globalStore.getThreadUI('7')?.unreadDividerId).toBe('8');

    updates.apply({ type: 'read.inbox', peerId: '7', maxId: 9, stillUnreadCount: 0 });
    expect(globalStore.getThreadUI('7')?.unreadDividerId).toBe('8');
  });
});
