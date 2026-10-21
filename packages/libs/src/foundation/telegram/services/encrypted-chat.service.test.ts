import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { LocalDb } from '../local-db/local-db';
import { EncryptedChatService } from './encrypted-chat.service';
import type { TransportService } from './transport.service';

type FakeClient = {
  invoke: jest.Mock;
};

function createService(client: FakeClient | null, localDb?: LocalDb): EncryptedChatService {
  return new EncryptedChatService({
    transportService: { client, debug: false } as unknown as TransportService,
    localDb,
  });
}

describe('EncryptedChatService.create', () => {
  it('throws when the client is missing', async () => {
    await expect(createService(null).create('42', '1')).rejects.toThrow('Client not initialized');
  });

  it('requests encryption after fetching dh config', async () => {
    const localDb = new LocalDb({
      accountSlot: `enc-create-${Date.now()}`,
      flushDelayMs: 10_000,
    });
    await localDb.open();
    await localDb.putUser({
      id: '42',
      firstName: 'Ada',
      accessHash: '2',
    } as any);

    const dhConfig = new Api.messages.DhConfig({
      g: 3,
      p: Buffer.alloc(256, 0xfb),
      version: 1,
      random: Buffer.alloc(256, 1),
    } as never);

    const waiting = new Api.EncryptedChatWaiting({
      id: 7,
      accessHash: bigInt(11),
      date: 1,
      adminId: bigInt(1),
      participantId: bigInt(42),
    } as never);

    const client: FakeClient = {
      invoke: jest
        .fn()
        .mockResolvedValueOnce(dhConfig)
        .mockResolvedValueOnce(waiting),
    };

    try {
      const result = await createService(client, localDb).create('42');
      expect(result).toMatchObject({ id: 7, adminId: '1', participantId: '42' });
      expect(client.invoke.mock.calls[0][0]).toBeInstanceOf(Api.messages.GetDhConfig);
      expect(client.invoke.mock.calls[1][0]).toBeInstanceOf(Api.messages.RequestEncryption);
    } finally {
      await localDb.deleteDatabase();
    }
  });
});

describe('EncryptedChatService.accept', () => {
  it('throws when chat is not requested', async () => {
    const localDb = new LocalDb({
      accountSlot: `enc-accept-${Date.now()}`,
      flushDelayMs: 10_000,
    });
    await localDb.open();

    try {
      const client: FakeClient = { invoke: jest.fn() };
      await expect(createService(client, localDb).accept(7)).rejects.toThrow(
        'Encrypted chat 7 is not in requested state',
      );
    } finally {
      await localDb.deleteDatabase();
    }
  });
});
