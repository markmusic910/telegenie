import type { LocalDbEntityChange } from '@telegenie/libs/foundation/telegram/local-db';
import { ConversionService } from '../modules/common/services/convert.service';
import { User } from './entity/models/user.model';
import { TeleGenieSDK } from '../telegenie.sdk';
import { createMockTelegramWorkerClient } from '../test-utils/mock-telegram-worker';

jest.mock('../modules/sw/sw.controller', () => ({
  SwController: class SwController {
    constructor() {}
  },
}));

jest.mock('@telegenie/libs/foundation/telegram/worker/create-default-telegram-worker', () => ({
  createDefaultTelegramWorker: () => ({
    call: jest.fn().mockResolvedValue(undefined),
    stream: async function* () {},
    on: jest.fn().mockReturnValue(() => {}),
    terminate: jest.fn(),
    worker: {
      postMessage: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      terminate: jest.fn(),
    },
  }),
}));

describe('LocalDb entity change bridge', () => {
  it('updates user store from a LocalDb users put with MobX models', () => {
    const sdk = new TeleGenieSDK({
      debug: false,
      createWorkerClient: () => createMockTelegramWorkerClient(),
    });
    const converter = new ConversionService();

    const change: LocalDbEntityChange = {
      store: 'users',
      kind: 'put',
      entities: [
        {
          id: '42',
          firstName: 'Ada',
          lastName: 'Lovelace',
          username: 'ada',
          accessHash: '1',
        } as any,
      ],
    };

    (sdk as any).handleLocalDbEntityChange(change);

    const user = sdk.store.get('user').getAllData().get('42');
    expect(user).toBeInstanceOf(User);
    expect(user?.firstName).toBe('Ada');
    expect(converter.convertLocalDbUsers(change.entities)[0].username).toBe('ada');
  });

  it('writes chatFull / channelFull on put and clears on invalidate', () => {
    const sdk = new TeleGenieSDK({
      debug: false,
      createWorkerClient: () => createMockTelegramWorkerClient(),
    });

    (sdk as any).handleLocalDbEntityChange({
      store: 'chatFull',
      kind: 'put',
      entities: [{ id: '10', about: 'group about' } as any],
    } satisfies LocalDbEntityChange);

    expect(sdk.store.get('chatFull').getAllData().get('10')?.about).toBe('group about');

    (sdk as any).handleLocalDbEntityChange({
      store: 'chatFull',
      kind: 'invalidate',
      ids: ['10'],
    } satisfies LocalDbEntityChange);

    expect(sdk.store.get('chatFull').getAllData().has('10')).toBe(false);

    (sdk as any).handleLocalDbEntityChange({
      store: 'channelFull',
      kind: 'put',
      entities: [{ id: '20', about: 'channel about' } as any],
    } satisfies LocalDbEntityChange);

    expect(sdk.store.get('channelFull').getAllData().get('20')?.about).toBe('channel about');
  });
});
