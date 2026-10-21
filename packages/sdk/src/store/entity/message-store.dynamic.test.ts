import { TeleGenieSDK, messageStoreName } from '../../telegenie.sdk';
import type { MessageEntity } from '../types';
import { createMockTelegramWorkerClient } from '../../test-utils/mock-telegram-worker';

jest.mock('../../modules/sw/sw.controller', () => ({
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

describe('TeleGenieSDK ensureMessageStore', () => {
  it('creates idempotent per-peer message stores', () => {
    const sdk = new TeleGenieSDK({
      debug: false,
      createWorkerClient: () => createMockTelegramWorkerClient(),
    });
    const a1 = sdk.ensureMessageStore('peer-a');
    const a2 = sdk.ensureMessageStore('peer-a');
    const b = sdk.ensureMessageStore('peer-b');

    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(sdk.store.has(messageStoreName('peer-a'))).toBe(true);
    expect(sdk.store.has(messageStoreName('peer-b'))).toBe(true);
  });

  it('keeps messages isolated per peer store', () => {
    const sdk = new TeleGenieSDK({
      debug: false,
      createWorkerClient: () => createMockTelegramWorkerClient(),
    });
    const msgA: MessageEntity = {
      kind: 'message',
      id: '1',
      peerId: 'peer-a',
      peerType: 'user',
      message: 'a',
      date: 1,
      out: true,
      fromId: 'peer-a',
      fromType: 'user',
      post: false,
      isEmpty: false,
    };
    const msgB: MessageEntity = {
      kind: 'message',
      id: '1',
      peerId: 'peer-b',
      peerType: 'user',
      message: 'b',
      date: 1,
      out: true,
      fromId: 'peer-b',
      fromType: 'user',
      post: false,
      isEmpty: false,
    };

    sdk.ensureMessageStore('peer-a').update([msgA]);
    sdk.ensureMessageStore('peer-b').update([msgB]);

    expect(sdk.getMessageStore('peer-a').getAllData().get('1')?.message).toBe('a');
    expect(sdk.getMessageStore('peer-b').getAllData().get('1')?.message).toBe('b');
  });
});
