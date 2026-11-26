import { EntityDataProvider } from '../../store/entity/entity.data-provider';
import EntityStore from '../../store/entity/entity.store';
import { Channel } from '../../store/entity/models/channel.model';
import { Dialog } from '../../store/entity/models/dialog.model';
import { UserFull } from '../../store/entity/models/user-full.model';
import { User } from '../../store/entity/models/user.model';
import GlobalStore from '../../store/global/global.store';
import StoreManager from '../../store/store.manager';
import type {
  ChannelEntity,
  DialogEntity,
  UserEntity,
  UserFullEntity,
} from '../../store/types';
import { MODEL_TYPE } from '../../store/types';
import { UserController } from './user.controller';

function createController(sm: StoreManager, call: jest.Mock, globalStore?: GlobalStore) {
  return new UserController({
    sm,
    globalStore,
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

describe('UserController profile navigation & mutations', () => {
  function setupStores() {
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    globalStore.auth.currentUser = { id: '1', firstName: 'Me', self: true } as UserEntity;

    const userStore = new EntityStore<User, UserEntity>({
      model: User,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const userFullStore = new EntityStore<UserFull, UserFullEntity>({
      model: UserFull,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });
    const dialogStore = new EntityStore<Dialog, DialogEntity>({
      model: Dialog,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    });

    sm.set('user', userStore);
    sm.set('userFull', userFullStore);
    sm.set('dialog', dialogStore);
    sm.set('global', globalStore);

    return { sm, globalStore, userStore, userFullStore, dialogStore };
  }

  it('pushes, deduplicates, pops, and clears profile stack while skipping deleted/non-users', () => {
    const { sm, globalStore, userStore } = setupStores();
    userStore.update([
      new User({ id: '42', firstName: 'Poolitzer', accessHash: '777' } as UserEntity),
      new User({ id: '99', firstName: 'Deleted', deleted: true } as UserEntity),
    ]);

    const call = jest.fn().mockResolvedValue({
      fullUsers: {},
      chats: {},
      channels: {},
      users: {},
    });
    const controller = createController(sm, call, globalStore);

    // Skips deleted user and channel IDs
    expect(controller.openProfile('99')).toBe(false);
    expect(controller.openProfile('-100123456')).toBe(false);
    expect(globalStore.nav.activeProfilePeerId).toBeUndefined();

    // Allows opening own profile (e.g. clicking self in "Forwarded from")
    expect(controller.openProfile('1')).toBe(true);
    expect(controller.popProfile()).toBe('1');

    // Pushes valid user and triggers background getFullUsers with forceRefresh
    expect(controller.openProfile('42')).toBe(true);
    expect(globalStore.nav.profilePeerIds).toEqual(['42']);
    expect(globalStore.nav.activeProfilePeerId).toBe('42');
    expect(call).toHaveBeenCalledWith('user.getFullUsers', [
      [{ id: '42', accessHash: '777' }],
      { forceRefresh: true },
    ]);

    // Consecutive duplicate push does not duplicate top of stack
    controller.openProfile('42');
    expect(globalStore.nav.profilePeerIds).toEqual(['42']);

    // Stacking a second user profile (e.g. via @mention in bio)
    expect(controller.openProfile('84')).toBe(true);
    expect(globalStore.nav.profilePeerIds).toEqual(['42', '84']);
    expect(globalStore.nav.activeProfilePeerId).toBe('84');

    // Popping steps back to previous profile
    expect(controller.popProfile()).toBe('84');
    expect(globalStore.nav.activeProfilePeerId).toBe('42');

    // Switching selected dialog clears the stack
    globalStore.nav.setSelectedDialogId('-100555');
    globalStore.nav.setSelectedDialogId('-100666');
    expect(globalStore.nav.profilePeerIds).toEqual([]);
  });

  it('mutates contact, blocked, and mute state in stores', async () => {
    const { sm, globalStore, userStore, userFullStore, dialogStore } = setupStores();
    userStore.update([
      new User({ id: '42', firstName: 'Poolitzer', accessHash: '777', contact: false } as UserEntity),
    ]);
    userFullStore.update([
      new UserFull({
        id: '42',
        about: 'bio',
        blocked: false,
        commonChatsCount: 0,
        settings: {} as never,
        notifySettings: { muteUntil: 0 },
      } as UserFullEntity),
    ]);
    dialogStore.update([
      new Dialog({
        id: '42',
        peerId: '42',
        topMessageId: '1',
        unreadCount: 0,
        isFolder: false,
        notifySettings: { muteUntil: 0 },
      } as DialogEntity),
    ]);

    const call = jest.fn().mockImplementation(async (method: string) => {
      if (method === 'user.addContact') {
        return { '42': { id: '42', firstName: 'Pool', lastName: 'X', contact: true } };
      }
      if (method === 'user.deleteContact') {
        return { '42': { id: '42', firstName: 'Pool', contact: false } };
      }
      if (method === 'user.setPeerMuted') {
        return { muteUntil: 2_147_483_647 };
      }
      return undefined;
    });

    const controller = createController(sm, call, globalStore);

    await controller.addContact({
      userId: '42',
      firstName: 'Pool',
      lastName: 'X',
      addPhonePrivacyException: true,
    });
    expect(userStore.get('42')?.contact).toBe(true);
    expect(userStore.get('42')?.firstName).toBe('Pool');

    await controller.deleteContact('42');
    expect(userStore.get('42')?.contact).toBe(false);

    await controller.setBlocked('42', true);
    expect(userFullStore.get('42')?.blocked).toBe(true);

    await controller.setMuted('42', true);
    expect(dialogStore.get('42')?.notifySettings?.muteUntil).toBe(2_147_483_647);
    expect(userFullStore.get('42')?.notifySettings?.muteUntil).toBe(2_147_483_647);
  });
});
