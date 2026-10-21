import { EntityDataProvider } from '../../entity/entity.data-provider';
import EntityStore from '../../entity/entity.store';
import { Dialog } from '../../entity/models/dialog.model';
import { Message } from '../../entity/models/message.model';
import StoreManager from '../../store.manager';
import { MODEL_TYPE, type DialogEntity, type MessageEntity } from '../../types';
import { GlobalStore } from '../global.store';
import { ThreadSlice } from './thread.slice';

function createMessage(id: string, peerId = '7'): Message {
  return new Message({
    id,
    peerId,
    date: 1_700_000_000 + Number(id),
    out: false,
    kind: 'message',
    isEmpty: false,
    message: `m${id}`,
  } as MessageEntity);
}

function setup() {
  const sm = new StoreManager();
  const messageStore = new EntityStore<Message, MessageEntity>({
    model: Message,
    type: MODEL_TYPE.ENTITY_MODEL,
    dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
  });
  sm.set('7-message', messageStore);
  sm.set(
    'dialog',
    new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    }),
  );
  sm.get('dialog').update([
    new Dialog({
      id: '7',
      peerId: '7',
      topMessageId: '100',
      unreadCount: 0,
      isFolder: false,
    } as DialogEntity),
  ]);
  const global = new GlobalStore(sm);
  return { sm, messageStore, global };
}

describe('ThreadSlice listed window', () => {
  it('builds flatItems from listed ids only and ignores cache islands', () => {
    const { messageStore, global } = setup();
    messageStore.update([
      createMessage('10'),
      createMessage('11'),
      createMessage('99'),
      createMessage('100'),
    ]);
    global.getOrCreateThreadUI('7').replaceListedWindow(['10', '11']);

    const items = global.getOrCreateThreadUI('7').getMessageList();
    const messageIds = items
      .filter((item) => item.kind === 'message' || item.kind === 'action')
      .map((item) => ('message' in item ? item.message.id : ''));
    expect(messageIds).toEqual(['10', '11']);
    expect(global.getThreadUI('7')?.hasMoreNewer).toBe(true);
    expect(global.getThreadUI('7')?.listedFollowsNewest).toBe(false);
  });

  it('does not list a reply-target orphan that is only in the store', () => {
    const { messageStore, global } = setup();
    messageStore.update([createMessage('5'), createMessage('50')]);
    global.getOrCreateThreadUI('7').replaceListedWindow(['50']);

    const items = global.getOrCreateThreadUI('7').getMessageList();
    expect(items.some((item) => item.kind === 'message' && item.message.id === '5')).toBe(false);
  });

  it('appends live messages onto the listed window', () => {
    const { messageStore, global } = setup();
    messageStore.update([createMessage('99'), createMessage('100')]);
    global.getOrCreateThreadUI('7').replaceListedWindow(['99', '100']);
    expect(global.getThreadUI('7')?.hasMoreNewer).toBe(false);
    expect(global.getThreadUI('7')?.listedFollowsNewest).toBe(true);

    messageStore.update([createMessage('101')]);
    global.getOrCreateThreadUI('7').appendLiveMessage('101');
    expect(global.getThreadUI('7')?.listedIds).toEqual(['99', '100', '101']);
    expect(global.getThreadUI('7')?.listedFollowsNewest).toBe(true);

    global.getOrCreateThreadUI('7').replaceListedWindow(['10', '11']);
    expect(global.getThreadUI('7')?.listedFollowsNewest).toBe(false);
    global.getOrCreateThreadUI('7').appendLiveMessage('102');
    expect(global.getThreadUI('7')?.listedIds).toEqual(['10', '11']);
    expect(global.getThreadUI('7')?.pendingNewerCount).toBe(1);
  });

  it('keeps listedFollowsNewest across a topMessageId bump until listed slides', () => {
    const { sm, global } = setup();
    global.getOrCreateThreadUI('7').replaceListedWindow(['99', '100']);
    expect(global.getThreadUI('7')?.listedFollowsNewest).toBe(true);

    sm.get('dialog').update([
      new Dialog({
        id: '7',
        peerId: '7',
        topMessageId: '101',
        unreadCount: 0,
        isFolder: false,
      } as DialogEntity),
    ]);
    expect(global.getThreadUI('7')?.hasMoreNewer).toBe(true);
    expect(global.getThreadUI('7')?.listedFollowsNewest).toBe(true);

    global.getOrCreateThreadUI('7').appendLiveMessage('101');
    expect(global.getThreadUI('7')?.listedIds).toEqual(['99', '100', '101']);
  });

  it('bumps pendingNewerCount when live ids arrive while scrolled up on the newest window', () => {
    const { global } = setup();
    global.getOrCreateThreadUI('7').replaceListedWindow(['99', '100']);
    global.getOrCreateThreadUI('7', '-1').setPinToBottom(false);
    global.getOrCreateThreadUI('7').appendLiveMessage('101');
    expect(global.getThreadUI('7')?.listedIds).toEqual(['99', '100', '101']);
    expect(global.getThreadUI('7')?.pendingNewerCount).toBe(1);
  });

  it('appends a live message onto an empty loaded newest window', () => {
    const { messageStore, global } = setup();
    global.getOrCreateThreadUI('7').setHistoryState({ historyLoaded: true });
    messageStore.update([createMessage('1')]);
    global.getOrCreateThreadUI('7').appendLiveMessage('1');
    expect(global.getThreadUI('7')?.listedIds).toEqual(['1']);
  });

  it('drops deleted ids from the listed window', () => {
    const { global } = setup();
    global.getOrCreateThreadUI('7').replaceListedWindow(['10', '11', '12']);
    global.getOrCreateThreadUI('7').dropListedIds(['11']);
    expect(global.getThreadUI('7')?.listedIds).toEqual(['10', '12']);
  });

  it('prepends and appends without replacing the window', () => {
    const { global } = setup();
    global.getOrCreateThreadUI('7').replaceListedWindow(['20', '21']);
    global.getOrCreateThreadUI('7').applyListedMessages([createMessage('18'), createMessage('19')], 'prepend');
    global.getOrCreateThreadUI('7').applyListedMessages([createMessage('22')], 'append');
    expect(global.getThreadUI('7')?.listedIds).toEqual(['18', '19', '20', '21', '22']);
  });

  it('records the listed island and item anchor when persisting scroll', () => {
    const { global } = setup();
    global.getOrCreateThreadUI('7').replaceListedWindow(['10', '11']);
    global.getOrCreateThreadUI('7', '-1').setScrollOffset(120, { itemId: '10', offsetInItem: 18 });
    expect(global.getThreadUI('7')?.scrollListedMinId).toBe('10');
    expect(global.getThreadUI('7')?.scrollListedMaxId).toBe('11');
    expect(global.getThreadUI('7')?.scrollAnchorItemId).toBe('10');
    expect(global.getThreadUI('7')?.scrollAnchorOffsetInItem).toBe(18);
  });

  it('clears the item anchor when the viewport is pinned to newest', () => {
    const { global } = setup();
    global.getOrCreateThreadUI('7').replaceListedWindow(['99', '100']);
    global.getOrCreateThreadUI('7', '-1').setScrollOffset(120, { itemId: '99', offsetInItem: 18 });
    global.getOrCreateThreadUI('7', '-1').setScrollOffset(20);
    expect(global.getThreadUI('7')?.scrollAnchorItemId).toBeUndefined();
    expect(global.getThreadUI('7')?.pinToBottom).toBe(true);
  });

  it('slides listedIds from cache until a private island break', () => {
    const { messageStore, global } = setup();
    messageStore.update([
      createMessage('10'),
      createMessage('12'),
      createMessage('14'),
      createMessage('79'),
      createMessage('80'),
    ]);
    global.getOrCreateThreadUI('7').ingestHistorySlice([10, 12, 14]);
    global.getOrCreateThreadUI('7').ingestHistorySlice([79, 80]);
    global.getOrCreateThreadUI('7').replaceListedWindow(['79', '80']);

    expect(global.getOrCreateThreadUI('7').slideListedFromCache('older', 10)).toEqual([]);
    expect(global.getThreadUI('7')?.listedIds).toEqual(['79', '80']);

    global.getOrCreateThreadUI('7').replaceListedWindow(['10', '12']);
    expect(global.getOrCreateThreadUI('7').slideListedFromCache('newer', 10)).toEqual([14]);
    expect(global.getThreadUI('7')?.listedIds).toEqual(['10', '12', '14']);
  });

  it('trims listedIds from the opposite end when sliding older without dropping cache', () => {
    const { global } = setup();
    const ids = Array.from({ length: 150 }, (_, i) => String(i + 1));
    global.getOrCreateThreadUI('7').ingestHistorySlice(ids.map(Number));
    global.getOrCreateThreadUI('7').replaceListedWindow(ids);
    global.getOrCreateThreadUI('7').prependListedIds(['0']);
    expect(global.getThreadUI('7')?.listedIds).toHaveLength(51);
    expect(global.getThreadUI('7')?.listedIds[0]).toBe('0');
    expect(global.getThreadUI('7')?.listedIds[50]).toBe('50');
    expect(global.getThreadUI('7')?.msgIndexes.cachedIds).toHaveLength(150);
    expect(global.getThreadUI('7')?.msgIndexes.cachedIds).toContain(150);
  });

  it('does not trim live appends on the newest window past 150', () => {
    const { sm, global } = setup();
    const ids = Array.from({ length: 150 }, (_, i) => String(i + 1));
    sm.get('dialog').update([
      new Dialog({
        id: '7',
        peerId: '7',
        topMessageId: '150',
        unreadCount: 0,
        isFolder: false,
      } as DialogEntity),
    ]);
    global.getOrCreateThreadUI('7').replaceListedWindow(ids);
    expect(global.getThreadUI('7')?.listedFollowsNewest).toBe(true);
    global.getOrCreateThreadUI('7').appendLiveMessage('151');
    expect(global.getThreadUI('7')?.listedIds).toHaveLength(151);
    expect(global.getThreadUI('7')?.listedIds[150]).toBe('151');
  });

  it('reconciles cached ids missing from the entity store', () => {
    const { messageStore, global } = setup();
    messageStore.update([createMessage('10'), createMessage('14')]);
    global.getOrCreateThreadUI('7').ingestHistorySlice([10, 12, 14]);
    global.getOrCreateThreadUI('7').reconcileIndexWithStore();
    expect(global.getThreadUI('7')?.msgIndexes.cachedIds).toEqual([10, 14]);
  });

  it('clears listedIds on history reset without wiping msgIndexes', () => {
    const { global } = setup();
    global.getOrCreateThreadUI('7').ingestHistorySlice([10, 12, 14]);
    global.getOrCreateThreadUI('7').replaceListedWindow(['10', '12', '14']);
    global.getOrCreateThreadUI('7').resetThreadHistoryState();
    expect(global.getThreadUI('7')?.listedIds).toEqual([]);
    expect(global.getThreadUI('7')?.msgIndexes.cachedIds).toEqual([10, 12, 14]);
    expect(global.getThreadUI('7')?.scrollOffset).toBe(0);
    expect(global.getThreadUI('7')?.pinToBottom).toBe(true);
    expect(global.getThreadUI('7')?.scrollAnchorItemId).toBeUndefined();
  });

  it('hasMoreOlder stays true after reaching the chat start until listed is at the oldest cached id', () => {
    const { global } = setup();
    global.getOrCreateThreadUI('7').ingestHistorySlice([10, 12, 14, 79, 80]);
    global.getOrCreateThreadUI('7').replaceListedWindow(['79', '80']);
    global.getOrCreateThreadUI('7').setHistoryState({ hasMoreHistory: false });

    expect(global.getThreadUI('7')?.hasMoreOlder).toBe(true);

    global.getOrCreateThreadUI('7').replaceListedWindow(['10', '12', '14']);
    expect(global.getThreadUI('7')?.hasMoreOlder).toBe(false);
  });

  it('hasMoreOlder is true at the cached min while the server may still have older history', () => {
    const { global } = setup();
    global.getOrCreateThreadUI('7').ingestHistorySlice([10, 12, 14]);
    global.getOrCreateThreadUI('7').replaceListedWindow(['10', '12', '14']);

    expect(global.getThreadUI('7')?.hasMoreHistory).not.toBe(false);
    expect(global.getThreadUI('7')?.hasMoreOlder).toBe(true);
  });

  it('hasMoreOlder compares to min message id in message entity store when msgIndexes is not the oldest', () => {
    const { global, messageStore } = setup();
    // Message store has messages starting from 10
    messageStore.update([
      createMessage('10'),
      createMessage('20'),
      createMessage('50'),
      createMessage('60'),
    ]);
    // msgIndexes only has a newer slice [50, 60]
    global.getOrCreateThreadUI('7').ingestHistorySlice([50, 60]);
    global.getOrCreateThreadUI('7').replaceListedWindow(['50', '60']);
    global.getOrCreateThreadUI('7').setHistoryState({ hasMoreHistory: false });

    // Even though msgIndexes.cachedIds[0] is 50 and listedIds[0] is '50',
    // messageStore has '10', so hasMoreOlder should be true!
    expect(global.getThreadUI('7')?.hasMoreOlder).toBe(true);

    // Once listed reaches the min message id in messageStore (10), hasMoreOlder is false
    global.getOrCreateThreadUI('7').replaceListedWindow(['10', '20']);
    expect(global.getThreadUI('7')?.hasMoreOlder).toBe(false);
  });

  it('hasMoreOlder compares to recorded oldestMessageId in thread state', () => {
    const { global } = setup();
    global.getOrCreateThreadUI('7').setHistoryState({ hasMoreHistory: false, oldestMessageId: '5' });
    global.getOrCreateThreadUI('7').replaceListedWindow(['20', '30']);

    expect(global.getThreadUI('7')?.hasMoreOlder).toBe(true);

    global.getOrCreateThreadUI('7').replaceListedWindow(['5', '10']);
    expect(global.getThreadUI('7')?.hasMoreOlder).toBe(false);
  });

  it('revives ThreadSlice instances and omits hasMoreNewer from snapshots', () => {
    const { global } = setup();
    global.getOrCreateThreadUI('7').replaceListedWindow(['99', '100']);
    global.getOrCreateThreadUI('7').setHistoryState({ oldestMessageId: '10' });
    expect(global.getThreadUI('7')).toBeInstanceOf(ThreadSlice);

    const snapshot = global.toJS().app;
    const persisted = snapshot.dialogs['7']?.threads?.['-1'];
    expect(persisted).toBeDefined();
    expect(persisted?.oldestMessageId).toBe('10');
    expect(persisted).not.toHaveProperty('hasMoreOlder');
    expect(persisted).not.toHaveProperty('hasMoreNewer');
    expect(persisted).not.toHaveProperty('flatItems');

    global.hydrateDialogsFromSnapshot({
      dialogs: {
        '7': {
          activeThreadId: '-1',
          threads: {
            '-1': {
              listedIds: ['99', '100'],
              listedFollowsNewest: true,
              hasMoreNewer: true,
            },
          },
        },
      },
    });
    const thread = global.getThreadUI('7');
    expect(thread).toBeInstanceOf(ThreadSlice);
    expect(thread?.hasMoreNewer).toBe(false);
  });

  it('recomputes hasMoreNewer when dialog.topMessageId changes', () => {
    const { sm, global } = setup();
    global.getOrCreateThreadUI('7').replaceListedWindow(['99', '100']);
    expect(global.getThreadUI('7')?.hasMoreNewer).toBe(false);

    sm.get('dialog').update([
      new Dialog({
        id: '7',
        peerId: '7',
        topMessageId: '200',
        unreadCount: 0,
        isFolder: false,
      } as DialogEntity),
    ]);
    expect(global.getThreadUI('7')?.listedIds).toEqual(['99', '100']);
    expect(global.getThreadUI('7')?.hasMoreNewer).toBe(true);
  });

  it('finishJumpToBottom resets pendingNewerCount, enables listedFollowsNewest and pinToBottom, and clears focus within action', () => {
    const { global } = setup();
    global.getOrCreateThreadUI('7').replaceListedWindow(['10', '11']);
    global.getOrCreateThreadUI('7', '-1').setPinToBottom(false);
    global.getOrCreateThreadUI('7', '-1').setPendingNewerCount(5);
    global.getOrCreateThreadUI('7', '-1').beginFocus('10');

    const thread = global.getThreadUI('7');
    expect(thread?.listedFollowsNewest).toBe(false);
    expect(thread?.pinToBottom).toBe(false);
    expect(thread?.pendingNewerCount).toBe(5);
    expect(thread?.focusedMessageId).toBe('10');

    global.getOrCreateThreadUI('7').finishJumpToBottom();

    expect(thread?.listedFollowsNewest).toBe(true);
    expect(thread?.pinToBottom).toBe(true);
    expect(thread?.pendingNewerCount).toBe(0);
    expect(thread?.focusedMessageId).toBeUndefined();
  });
});
