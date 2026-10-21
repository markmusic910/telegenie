import EntityStore from './entity.store';
import { MODEL_TYPE, type MessageEntity } from '../types';
import { Message } from './models/message.model';
import { EntityDataProvider } from './entity.data-provider';

function createMessageStore(onChange?: (change: any) => void) {
  return new EntityStore<Message, MessageEntity>({
    model: Message,
    type: MODEL_TYPE.ENTITY_MODEL,
    dataProvider: new EntityDataProvider<MessageEntity>({
      fetcher: async () => [],
    }),
    onChange,
  });
}

const sampleMessage = (overrides: Partial<MessageEntity> = {}): MessageEntity => ({
  kind: 'message',
  id: '1',
  peerId: '100',
  peerType: 'user',
  message: 'hi',
  date: 1,
  out: true,
  fromId: '100',
  fromType: 'user',
  post: false,
  isEmpty: false,
  ...overrides,
});

describe('EntityStore direct updates', () => {
  it('update upserts entities without NotificationCenter', () => {
    const store = createMessageStore();
    store.update([sampleMessage()]);

    expect(store.getSize()).toBe(1);
    expect(store.getAllData().get('1')?.message).toBe('hi');
    expect(store.getAllData().get('1')).toBeInstanceOf(Message);
  });

  it('deleteByIds removes entities and fires onChange', () => {
    const changes: any[] = [];
    const store = createMessageStore((c) => changes.push(c));
    store.update([sampleMessage()]);
    store.deleteByIds(['1']);
    expect(store.getSize()).toBe(0);
    expect(changes.some((c) => c.type === 'delete')).toBe(true);
  });

  it('clear removes every entity and fires onChange', () => {
    const changes: any[] = [];
    const store = createMessageStore((c) => changes.push(c));
    store.update([sampleMessage(), sampleMessage({ id: '2', message: 'bye' })]);
    store.clear();
    expect(store.getSize()).toBe(0);
    expect(changes.some((c) => c.type === 'delete' && c.ids.includes('1') && c.ids.includes('2'))).toBe(
      true,
    );
  });

  it('hydrate does not fire onChange', () => {
    const changes: any[] = [];
    const store = createMessageStore((c) => changes.push(c));
    store.hydrate([sampleMessage({ id: '2', message: 'cached', date: 2, out: false })]);
    expect(store.getSize()).toBe(1);
    expect(changes).toHaveLength(0);
  });
});
