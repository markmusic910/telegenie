import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { CHANNEL_ID_LENGTH } from './constants';
import {
  checkIfChannelId,
  getDownloadPartSize,
  getPeer,
  getTelegramCredentials,
  getWebDC,
  isChannelId,
  isChatBasicGroup,
  isChatChannel,
  isChatGroup,
  isChatSuperGroup,
  isCommonBoxChat,
  isPeerChat,
  isPeerUser,
  isUserId,
  readPeerAccessHash,
  toChannelId,
  type PeerEntitySource,
} from './utils';

describe('CHANNEL_ID_LENGTH', () => {
  it('is 14', () => {
    expect(CHANNEL_ID_LENGTH).toBe(14);
  });
});

describe('getTelegramCredentials', () => {
  const prevId = process.env.NEXT_PUBLIC_TELEGRAM_API_ID;
  const prevHash = process.env.NEXT_PUBLIC_TELEGRAM_API_HASH;

  afterEach(() => {
    if (prevId === undefined) delete process.env.NEXT_PUBLIC_TELEGRAM_API_ID;
    else process.env.NEXT_PUBLIC_TELEGRAM_API_ID = prevId;
    if (prevHash === undefined) delete process.env.NEXT_PUBLIC_TELEGRAM_API_HASH;
    else process.env.NEXT_PUBLIC_TELEGRAM_API_HASH = prevHash;
  });

  it('reads from env and allows overrides', () => {
    process.env.NEXT_PUBLIC_TELEGRAM_API_ID = '123';
    process.env.NEXT_PUBLIC_TELEGRAM_API_HASH = 'hash';
    expect(getTelegramCredentials()).toEqual({ apiId: 123, apiHash: 'hash' });
    expect(getTelegramCredentials({ apiId: 9, apiHash: 'x' })).toEqual({
      apiId: 9,
      apiHash: 'x',
    });
  });

  it('falls back when env is missing', () => {
    delete process.env.NEXT_PUBLIC_TELEGRAM_API_ID;
    delete process.env.NEXT_PUBLIC_TELEGRAM_API_HASH;
    expect(getTelegramCredentials()).toEqual({ apiId: 0, apiHash: '' });
  });
});

describe('getWebDC', () => {
  it.each([1, 2, 3, 4, 5] as const)('returns DC %s', (dcId) => {
    expect(getWebDC(dcId)).toEqual({
      id: dcId,
      ipAddress: `zws${dcId}.web.telegram.org`,
      port: 443,
    });
    expect(getWebDC(dcId, true).ipAddress).toBe(`zws${dcId}-1.web.telegram.org`);
  });

  it('throws for unknown DC', () => {
    expect(() => getWebDC(99)).toThrow(/Cannot find the DC/);
  });
});

describe('id helpers', () => {
  it('classifies user and channel ids', () => {
    expect(isUserId('42')).toBe(true);
    expect(isUserId('-10')).toBe(false);
    expect(checkIfChannelId('-1000000000777')).toBe(true);
    expect(isChannelId('-1000000000777')).toBe(true);
    expect(isChannelId('-10')).toBe(false);
    expect(toChannelId('777')).toBe('-1000000000777');
  });
});

describe('chat type helpers', () => {
  const chat = (type: string) => ({ type }) as any;

  it('detects group/channel/common-box types', () => {
    expect(isChatBasicGroup(chat('chatTypeBasicGroup'))).toBe(true);
    expect(isChatSuperGroup(chat('chatTypeSuperGroup'))).toBe(true);
    expect(isChatChannel(chat('chatTypeChannel'))).toBe(true);
    expect(isChatGroup(chat('chatTypeBasicGroup'))).toBe(true);
    expect(isChatGroup(chat('chatTypeSuperGroup'))).toBe(true);
    expect(isChatGroup(chat('chatTypeChannel'))).toBe(false);
    expect(isCommonBoxChat(chat('chatTypePrivate'))).toBe(true);
    expect(isCommonBoxChat(chat('chatTypeBasicGroup'))).toBe(true);
    expect(isCommonBoxChat(chat('chatTypeChannel'))).toBe(false);
  });
});

describe('peer helpers', () => {
  it('isPeerChat / isPeerUser', () => {
    expect(isPeerChat({ title: 'x' } as any)).toBe(true);
    expect(isPeerUser({ firstName: 'a' } as any)).toBe(true);
  });

  it('getPeer extracts user/group/channel', () => {
    expect(getPeer(new Api.PeerUser({ userId: bigInt(1) }))).toEqual(['user', '1']);
    expect(getPeer(new Api.PeerChat({ chatId: bigInt(2) }))).toEqual(['group', '2']);
    expect(getPeer(new Api.PeerChannel({ channelId: bigInt(3) }))).toEqual([
      'channel',
      '3',
    ]);
    expect(() => getPeer({} as any)).toThrow(/Invalid peer/);
    expect(() => getPeer(null)).toThrow(/Invalid peer/);
  });
});

describe('readPeerAccessHash', () => {
  const CHANNEL_ID = '-1000000000009';

  function source(rows: Record<string, Record<string, { accessHash?: string }>>): PeerEntitySource {
    return {
      has: (name) => name in rows,
      get: (name) => ({
        get: (id) => rows[name]?.[id],
      }),
    };
  }

  it('reads a user or channel hash and skips basic groups', () => {
    const entities = source({
      user: { '7': { accessHash: 'user-hash' } },
      channel: { [CHANNEL_ID]: { accessHash: 'chan-hash' } },
    });
    expect(readPeerAccessHash(entities, '7')).toBe('user-hash');
    expect(readPeerAccessHash(entities, CHANNEL_ID)).toBe('chan-hash');
    expect(readPeerAccessHash(entities, '-42')).toBeUndefined();
  });

  it('returns undefined when the peer store is missing', () => {
    expect(readPeerAccessHash(source({}), '7')).toBeUndefined();
  });
});

describe('getDownloadPartSize', () => {
  it('picks part size by file size', () => {
    expect(getDownloadPartSize(1)).toBe(64);
    expect(getDownloadPartSize(65_536)).toBe(64);
    expect(getDownloadPartSize(65_537)).toBe(128);
    expect(getDownloadPartSize(104_857_600)).toBe(128);
    expect(getDownloadPartSize(104_857_601)).toBe(256);
    expect(getDownloadPartSize(786_432_000)).toBe(256);
    expect(getDownloadPartSize(786_432_001)).toBe(512);
    expect(getDownloadPartSize(2_097_152_000)).toBe(512);
    expect(getDownloadPartSize(2_097_152_001)).toBe(1024);
    expect(getDownloadPartSize(4_194_304_000)).toBe(1024);
  });

  it('throws when file is too large', () => {
    expect(() => getDownloadPartSize(4_194_304_001)).toThrow(/too large/);
  });
});
