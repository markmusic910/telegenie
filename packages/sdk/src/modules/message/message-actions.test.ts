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
  type UserEntity,
} from '../../store/types';
import { UpdatesController } from '../updates/updates.controller';
import { MessageDraftController } from './message-draft.controller';
import { MessageSendController } from './message-send.controller';

function putNew(peerId: string, id: number, message = 'hi'): StoreSyncPayload {
  return {
    type: 'message.put',
    op: 'new',
    messages: [{ id, date: 100, message, peer_id: { userId: peerId }, out: true }],
    messageServices: [],
    emptyMessages: [],
  };
}

function createHarness(call: jest.Mock = jest.fn().mockResolvedValue(undefined)) {
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
  const worker = { call } as never;
  const drafts = new MessageDraftController({ worker, sm, globalStore });
  const send = new MessageSendController({
    worker,
    sm,
    globalStore,
    drafts,
    jumpToBottom: async () => undefined,
    applyLocalDelete: (peerId, ids) => updates.applyLocalMessageDelete(peerId, ids),
  });
  return { sm, globalStore, ensureMessageStore, updates, drafts, send, call };
}

describe('message forward and delete', () => {
  it('keeps a staged forward off the thread snapshot', () => {
    const { globalStore, drafts } = createHarness();
    drafts.stageForward('9', '7', '42');
    const thread = globalStore.getThreadUI('9');
    expect(thread?.forwarding).toEqual({ fromPeerId: '7', messageId: '42', dropAuthor: false });

    drafts.setForwardDropAuthor('9', true);
    expect(thread?.forwarding?.dropAuthor).toBe(true);
    expect(thread?.toSnapshot()).not.toHaveProperty('forwarding');

    const snapshot = thread!.toSnapshot();
    thread!.setForwarding(undefined);
    thread!.hydrateFromSnapshot(snapshot);
    expect(thread?.forwarding).toBeUndefined();
  });

  it('deletes the local message after the RPC succeeds', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const { send, updates, ensureMessageStore, call: workerCall } = createHarness(call);
    updates.apply(putNew('7', 5));

    const result = await send.deleteMessages('7', [5], { revoke: true });

    expect(result).toEqual({ ok: true, messageId: 5 });
    expect(workerCall).toHaveBeenCalledWith('message.deleteMessages', ['7', [5], true, undefined]);
    expect(ensureMessageStore('7').getAllData().has('5')).toBe(false);
  });

  it('leaves the message when delete fails', async () => {
    const call = jest.fn().mockRejectedValue(new Error('fail'));
    const { send, updates, ensureMessageStore } = createHarness(call);
    updates.apply(putNew('7', 5));

    await expect(send.deleteMessages('7', [5], { revoke: false })).resolves.toEqual({ ok: false });
    expect(ensureMessageStore('7').getAllData().has('5')).toBe(true);
  });

  it('forwards to Saved Messages silently', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const { send, globalStore } = createHarness(call);
    globalStore.auth.currentUser = { id: '7' } as UserEntity;

    await expect(send.forwardToSavedMessages('42', '9')).resolves.toEqual({ ok: true, messageId: 9 });
    expect(call).toHaveBeenCalledWith('message.forwardMessages', [
      '42',
      '7',
      [9],
      undefined,
      undefined,
      { silent: true },
    ]);
  });

  it('sends a staged forward and then clears it', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const { send, drafts, globalStore } = createHarness(call);
    drafts.stageForward('9', '7', '42');
    drafts.setForwardDropAuthor('9', true);

    await expect(send.forwardStaged('9')).resolves.toEqual({ ok: true, messageId: 42 });
    expect(call).toHaveBeenCalledWith('message.forwardMessages', [
      '7',
      '9',
      [42],
      undefined,
      undefined,
      { dropAuthor: true },
    ]);
    expect(globalStore.getThreadUI('9')?.forwarding).toBeUndefined();
  });
});
