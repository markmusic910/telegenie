import type { StoreSyncPayload } from '@telegenie/libs/foundation/telegram/worker';
import { EntityDataProvider } from '../../store/entity/entity.data-provider';
import EntityStore from '../../store/entity/entity.store';
import { Dialog } from '../../store/entity/models/dialog.model';
import { Message } from '../../store/entity/models/message.model';
import { GlobalStore } from '../../store';
import StoreManager from '../../store/store.manager';
import {
  MODEL_TYPE,
  type DialogEntity,
  type MessageEntity,
  type MessageStore,
} from '../../store/types';
import { UpdatesController } from '../updates/updates.controller';
import { MessageSelectController } from './message-select.controller';

function putNew(peerId: string, id: number, message = 'hi'): StoreSyncPayload {
  return {
    type: 'message.put',
    op: 'new',
    messages: [{ id, date: 100 + id, message, peer_id: { userId: peerId }, out: true }],
    messageServices: [],
    emptyMessages: [],
  };
}

function createHarness() {
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
  const updates = new UpdatesController({ sm, ensureMessageStore, globalStore });
  const select = new MessageSelectController({ globalStore, ensureMessageStore });
  return { globalStore, updates, select };
}

function seed(peerId: string, ids: number[]) {
  const harness = createHarness();
  for (const id of ids) harness.updates.apply(putNew(peerId, id, `text ${id}`));
  const thread = harness.globalStore.getOrCreateThreadUI(peerId);
  thread.replaceListedWindow(ids.map(String));
  return { ...harness, thread };
}

describe('MessageSelectController', () => {
  it('enters select mode with no ids and stays in it', () => {
    const { select, thread } = seed('7', [1, 2]);
    select.enter('7');
    expect(thread.isSelectMode).toBe(true);
    expect(thread.selectedMessageIds).toEqual([]);
  });

  it('toggles a row on and off, and leaves select mode when the last id goes', () => {
    const { select, thread } = seed('7', [1, 2]);
    select.toggle('7', { messageId: '1' });
    expect(thread.isSelectMode).toBe(true);
    expect(thread.isMessageSelected('1')).toBe(true);

    select.toggle('7', { messageId: '2' });
    select.toggle('7', { messageId: '1' });
    expect(thread.selectedMessageIds).toEqual(['2']);
    expect(thread.isSelectMode).toBe(true);

    select.toggle('7', { messageId: '2' });
    expect(thread.selectedMessageIds).toEqual([]);
    expect(thread.isSelectMode).toBe(false);
  });

  it('toggles every id of an album together', () => {
    const { select, thread } = seed('7', [1, 2, 3]);
    select.toggle('7', { messageId: '2', childMessageIds: ['2', '3'] });
    expect(thread.selectedMessageIds).toEqual(['2', '3']);
    select.toggle('7', { messageId: '2', childMessageIds: ['2', '3'] });
    expect(thread.isSelectMode).toBe(false);
  });

  it('selects the listed rows between the anchor and a shift-click', () => {
    const { select, thread } = seed('7', [1, 2, 3, 4, 5]);
    select.toggle('7', { messageId: '2' });
    select.toggle('7', { messageId: '5', withShift: true });
    expect(new Set(thread.selectedMessageIds)).toEqual(new Set(['2', '3', '4', '5']));
  });

  it('ignores shift when nothing is selected or the anchor is not listed', () => {
    const { select, thread } = seed('7', [1, 2, 3]);
    select.toggle('7', { messageId: '3', withShift: true });
    expect(thread.selectedMessageIds).toEqual(['3']);

    thread.dropListedIds(['3']);
    select.toggle('7', { messageId: '1', withShift: true });
    expect(new Set(thread.selectedMessageIds)).toEqual(new Set(['3', '1']));
  });

  it('skips ids that are not real server ids', () => {
    const { select, thread } = seed('7', [1]);
    select.toggle('7', { messageId: '0' });
    select.toggle('7', { messageId: 'abc' });
    expect(thread.isSelectMode).toBe(false);
  });

  it('exit clears the selection', () => {
    const { select, thread } = seed('7', [1, 2]);
    select.toggle('7', { messageId: '1' });
    select.exit('7');
    expect(thread.isSelectMode).toBe(false);
    expect(thread.selectedMessageIds).toEqual([]);
  });

  it('copies selected text oldest first, one block per message', () => {
    const { select } = seed('7', [1, 2, 3]);
    select.toggle('7', { messageId: '3' });
    select.toggle('7', { messageId: '1' });
    expect(select.getSelectedMessages('7').map((m) => m.id)).toEqual(['1', '3']);
    expect(select.copyText('7')).toBe('text 1\ntext 3');
  });

  it('keeps selection independent between two threads of one peer', () => {
    const { select, globalStore } = seed('7', [1, 2]);
    globalStore.getOrCreateThreadUI('7', '55');
    select.toggle('7', { messageId: '1' });
    expect(globalStore.getThreadUI('7', '55')?.isSelectMode).toBe(false);
    select.toggle('7', { messageId: '2' }, '55');
    expect(globalStore.getThreadUI('7')?.selectedMessageIds).toEqual(['1']);
    expect(globalStore.getThreadUI('7', '55')?.selectedMessageIds).toEqual(['2']);
  });

  it('keeps selection off the thread snapshot', () => {
    const { select, thread } = seed('7', [1]);
    select.toggle('7', { messageId: '1' });
    const snapshot = thread.toSnapshot();
    expect(snapshot).not.toHaveProperty('isSelectMode');
    expect(snapshot).not.toHaveProperty('selectedMessageIds');
    thread.hydrateFromSnapshot(snapshot);
    expect(thread.isMessageSelected('1')).toBe(true);
  });

  it('clears the selection when the user opens another dialog', () => {
    const { select, thread, globalStore } = seed('7', [1]);
    globalStore.nav.setSelectedDialogId('7');
    select.toggle('7', { messageId: '1' });
    globalStore.nav.setSelectedDialogId('8');
    expect(thread.isSelectMode).toBe(false);
    expect(thread.selectedMessageIds).toEqual([]);
  });

  it('clears the previous thread when the active thread changes', () => {
    const { select, thread, globalStore } = seed('7', [1]);
    const dialogUI = globalStore.getOrCreateDialogUI('7');
    dialogUI.getOrCreateThread('55');
    select.toggle('7', { messageId: '1' });
    dialogUI.setActiveThreadId('55');
    expect(thread.isSelectMode).toBe(false);
  });

  it('prunes deleted ids in every thread and leaves select mode when emptied', () => {
    const { select, updates, globalStore } = seed('7', [1, 2, 3]);
    const other = globalStore.getOrCreateThreadUI('7', '55');
    const main = globalStore.getOrCreateThreadUI('7');
    select.toggle('7', { messageId: '1' });
    select.toggle('7', { messageId: '2' });
    select.toggle('7', { messageId: '1' }, '55');

    updates.applyLocalMessageDelete('7', [1]);
    expect(main.selectedMessageIds).toEqual(['2']);
    expect(main.isSelectMode).toBe(true);
    expect(other.isSelectMode).toBe(false);

    updates.applyLocalMessageDelete('7', [2, 3]);
    expect(main.isSelectMode).toBe(false);
  });

  it('keeps select mode when a delete removes nothing that was selected', () => {
    const { select, updates, thread } = seed('7', [1, 2]);
    select.enter('7');
    updates.applyLocalMessageDelete('7', [1]);
    expect(thread.isSelectMode).toBe(true);
  });
});
