import { EntityDataProvider } from '../../store/entity/entity.data-provider';
import EntityStore from '../../store/entity/entity.store';
import { Channel } from '../../store/entity/models/channel.model';
import { User } from '../../store/entity/models/user.model';
import StoreManager from '../../store/store.manager';
import type { ChannelEntity, UserEntity } from '../../store/types';
import { MODEL_TYPE } from '../../store/types';
import { UserController } from './user.controller';

function createController(sm: StoreManager, call: jest.Mock) {
  return new UserController({
    sm,
    worker: { call } as never,
  });
}

describe('UserController.resolveUsername', () => {
  it('returns a local peer id without calling the worker', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    const userStore = new EntityStore<User, UserEntity>({
      model: User,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    userStore.update([new User({ id: '42', username: 'alice' } as UserEntity)]);
    sm.set('user', userStore);
    sm.set(
      'channel',
      new EntityStore<Channel, ChannelEntity>({
        model: Channel,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );

    const controller = createController(sm, call);
    await expect(controller.resolveUsername('@alice')).resolves.toBe('42');
    expect(call).not.toHaveBeenCalled();
  });

  it('returns a local channel peer id from usernames[] without calling the worker', async () => {
    const call = jest.fn();
    const sm = new StoreManager();
    sm.set(
      'user',
      new EntityStore<User, UserEntity>({
        model: User,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );
    const channelStore = new EntityStore<Channel, ChannelEntity>({
      model: Channel,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    channelStore.update([
      new Channel({
        id: '-1009',
        usernames: [{ username: 'news' }],
      } as ChannelEntity),
    ]);
    sm.set('channel', channelStore);

    const controller = createController(sm, call);
    await expect(controller.resolveUsername('news')).resolves.toBe('-1009');
    expect(call).not.toHaveBeenCalled();
  });

  it('hydrates stores from the worker result on cache miss', async () => {
    const call = jest.fn().mockResolvedValue({
      peerId: '99',
      users: [{ id: '99', firstName: 'Bob' }],
      chats: [],
      channels: [],
    });
    const sm = new StoreManager();
    sm.set(
      'user',
      new EntityStore<User, UserEntity>({
        model: User,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );
    sm.set(
      'channel',
      new EntityStore<Channel, ChannelEntity>({
        model: Channel,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
      }),
    );

    const controller = createController(sm, call);
    await expect(controller.resolveUsername('bob')).resolves.toBe('99');
    expect(call).toHaveBeenCalledWith('user.resolveUsername', ['bob']);
    expect(sm.get('user').get('99')).toBeDefined();
  });
});
