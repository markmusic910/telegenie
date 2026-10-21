import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { LocalDb } from '../local-db/local-db';
import { tryBuildSource } from './extractors';
import { evalFallbackOp, evalTypedOp } from './typed-op';
import {
  coerceForApi,
  ExtractAbort,
  getField,
  isEmptyFlag,
  matchesPredicate,
  predicateOf,
  readId,
  reconstructTl,
  toStoredValue,
} from './tl-value';
import { isMethodFrame, type MethodFrame } from './types';
import { refreshFileId } from './refresh';
import { indexFileRefMap } from './map-index';
import DEFAULT_MAP_JSON from './file_ref_map.json';
import type { FileReferenceMapJson } from './types';
import { FileRefEngine, parseFileRefError } from './engine';
import { IncomingTraverser } from './incoming';
import { OutgoingTraverser } from './outgoing';
import { classNameToPredicate, predicateToClassName } from './names';

const indexed = indexFileRefMap(DEFAULT_MAP_JSON as FileReferenceMapJson);
const outgoing = new OutgoingTraverser(indexed);

function incomingOf(db: LocalDb, getSelfId: () => Promise<string | undefined> = async () => '5') {
  return new IncomingTraverser({ localDb: db, map: indexed, getSelfId });
}

function createDb() {
  return new LocalDb({
    accountSlot: `frx-${Date.now()}-${Math.random()}`,
    flushDelayMs: 10_000,
  });
}

const emptyCtx = {
  parentContext: new Map<string, unknown[]>(),
  getSelfId: async () => '42',
};

describe('tl-value extras', () => {
  it('handles method frames, empty flags, and ids', () => {
    const frame: MethodFrame = {
      __fileRefMethod: true,
      method: 'messages.getHistory',
      request: { peer: 'x' },
      result: { ok: true },
      className: 'messages.GetHistory',
    };
    expect(isMethodFrame(frame)).toBe(true);
    expect(predicateOf(frame)).toBe('messages.getHistory');
    expect(getField(frame, '')).toEqual({ ok: true });
    expect(getField(frame, 'peer')).toBe('x');
    expect(matchesPredicate(frame, 'messages.getHistory')).toBe(true);
    expect(isEmptyFlag(undefined)).toBe(true);
    expect(isEmptyFlag(1)).toBe(false);
    expect(readId(undefined)).toBeUndefined();
    expect(readId(bigInt(8))).toBe('8');
    expect(readId(9n)).toBe('9');
    expect(predicateOf({ _: 'photo' })).toBe('photo');
    expect(predicateOf(null)).toBeUndefined();
    expect(reconstructTl({ _: 'bytes', bytes: Buffer.from('z').toString('base64') })).toBeInstanceOf(
      Buffer,
    );
    expect(reconstructTl(['a'])).toEqual(['a']);
    expect(toStoredValue([1, 2])).toEqual([1, 2]);
    expect(toStoredValue(9n)).toBe('9');
    expect(coerceForApi(undefined, 'long')).toBeUndefined();
    expect(coerceForApi(Buffer.from('a'), 'bytes')).toBeInstanceOf(Buffer);
  });

  it('maps empty names', () => {
    expect(predicateToClassName('')).toBe('');
    expect(classNameToPredicate('')).toBe('');
  });
});

describe('extractors extra paths', () => {
  it('extracts from input peers and users', async () => {
    const inputUser = new Api.InputPeerUser({ userId: bigInt(5), accessHash: bigInt(1) });
    const chat = new Api.InputPeerChat({ chatId: bigInt(6) });
    const channel = new Api.InputPeerChannel({ channelId: bigInt(7), accessHash: bigInt(1) });
    const self = new Api.InputPeerSelf();

    const wrap = (obj: object, pred: string) =>
      Object.assign(obj, { className: pred.charAt(0).toUpperCase() + pred.slice(1) });

    expect(
      (await tryBuildSource(
        {
          stored_constructor: 'fileSourceUserFull',
          stored_params: [
            {
              _: 'extractPeerIdFromInputPeerAndStore',
              from: {
                _: 'path',
                parts: [
                  {
                    _: 'pathPart',
                    constructor: 'inputPeerUser',
                    param: '',
                    flag: { _: 'paramNotFlag' },
                  },
                ],
              },
              to: 'id',
            },
          ],
        },
        { current: wrap(inputUser, 'inputPeerUser'), ...emptyCtx },
      ))?.id,
    ).toBe('5');

    expect(
      (await tryBuildSource(
        {
          stored_constructor: 'fileSourceChatFull',
          stored_params: [
            {
              _: 'extractPeerIdFromInputPeerAndStore',
              from: {
                _: 'path',
                parts: [
                  {
                    _: 'pathPart',
                    constructor: 'inputPeerChat',
                    param: '',
                    flag: { _: 'paramNotFlag' },
                  },
                ],
              },
              to: 'chat_id',
            },
          ],
        },
        { current: wrap(chat, 'inputPeerChat'), ...emptyCtx },
      ))?.chat_id,
    ).toBe('-6');

    expect(
      (await tryBuildSource(
        {
          stored_constructor: 'fileSourceChannelFull',
          stored_params: [
            {
              _: 'extractPeerIdFromInputPeerAndStore',
              from: {
                _: 'path',
                parts: [
                  {
                    _: 'pathPart',
                    constructor: 'inputPeerChannel',
                    param: '',
                    flag: { _: 'paramNotFlag' },
                  },
                ],
              },
              to: 'channel',
            },
          ],
        },
        { current: wrap(channel, 'inputPeerChannel'), ...emptyCtx },
      ))?.channel,
    ).toBe('-1000000000007');

    expect(
      (await tryBuildSource(
        {
          stored_constructor: 'fileSourceUserFull',
          stored_params: [
            {
              _: 'extractPeerIdFromInputPeerAndStore',
              from: {
                _: 'path',
                parts: [
                  {
                    _: 'pathPart',
                    constructor: 'inputPeerSelf',
                    param: '',
                    flag: { _: 'paramNotFlag' },
                  },
                ],
              },
              to: 'id',
            },
          ],
        },
        { current: wrap(self, 'inputPeerSelf'), ...emptyCtx },
      ))?.id,
    ).toBe('42');

    expect(
      await tryBuildSource(
        {
          stored_constructor: 'fileSourceUserFull',
          stored_params: [
            {
              _: 'extractPeerIdFromInputPeerAndStore',
              from: {
                _: 'path',
                parts: [
                  {
                    _: 'pathPart',
                    constructor: 'inputPeerEmpty',
                    param: '',
                    flag: { _: 'paramNotFlag' },
                  },
                ],
              },
              to: 'id',
            },
          ],
        },
        { current: wrap(new Api.InputPeerEmpty(), 'inputPeerEmpty'), ...emptyCtx },
      ),
    ).toBeUndefined();
  });

  it('extracts channel/user ids and sticker sets', async () => {
    const inputChannel = Object.assign(
      new Api.InputChannel({ channelId: bigInt(3), accessHash: bigInt(1) }),
      { className: 'InputChannel' },
    );
    expect(
      (await tryBuildSource(
        {
          stored_constructor: 'fileSourceAdminLog',
          stored_params: [
            {
              _: 'extractChannelIdFromInputChannelAndStore',
              from: {
                _: 'path',
                parts: [
                  {
                    _: 'pathPart',
                    constructor: 'inputChannel',
                    param: '',
                    flag: { _: 'paramNotFlag' },
                  },
                ],
              },
              to: 'channel',
            },
          ],
        },
        { current: inputChannel, ...emptyCtx },
      ))?.channel,
    ).toBe('3');

    const inputUser = Object.assign(
      new Api.InputUser({ userId: bigInt(4), accessHash: bigInt(1) }),
      { className: 'InputUser' },
    );
    expect(
      (await tryBuildSource(
        {
          stored_constructor: 'fileSourceUserFull',
          stored_params: [
            {
              _: 'extractUserIdFromInputUserAndStore',
              from: {
                _: 'path',
                parts: [
                  {
                    _: 'pathPart',
                    constructor: 'inputUser',
                    param: '',
                    flag: { _: 'paramNotFlag' },
                  },
                ],
              },
              to: 'id',
            },
          ],
        },
        { current: inputUser, ...emptyCtx },
      ))?.id,
    ).toBe('4');

    const selfUser = Object.assign(new Api.InputUserSelf(), { className: 'InputUserSelf' });
    expect(
      (await tryBuildSource(
        {
          stored_constructor: 'fileSourceUserFull',
          stored_params: [
            {
              _: 'extractUserIdFromInputUserAndStore',
              from: {
                _: 'path',
                parts: [
                  {
                    _: 'pathPart',
                    constructor: 'inputUserSelf',
                    param: '',
                    flag: { _: 'paramNotFlag' },
                  },
                ],
              },
              to: 'id',
            },
          ],
        },
        { current: selfUser, ...emptyCtx },
      ))?.id,
    ).toBe('42');

    const user = Object.assign(new Api.User({ id: bigInt(8) } as never), { className: 'User', id: bigInt(8) });
    expect(
      (await tryBuildSource(
        {
          stored_constructor: 'fileSourceUserFull',
          stored_params: [
            {
              _: 'extractUserIdFromUserAndStore',
              from: {
                _: 'path',
                parts: [
                  {
                    _: 'pathPart',
                    constructor: 'user',
                    param: '',
                    flag: { _: 'paramNotFlag' },
                  },
                ],
              },
              to: 'id',
            },
          ],
        },
        { current: user, ...emptyCtx },
      ))?.id,
    ).toBe('8');

    const attrs = [
      new Api.DocumentAttributeSticker({
        alt: '',
        stickerset: new Api.InputStickerSetID({ id: bigInt(1), accessHash: bigInt(2) }),
      }),
    ];
    const holder = { className: 'Document', attributes: attrs };
    expect(
      (await tryBuildSource(
        {
          stored_constructor: 'fileSourceStickerSet',
          stored_params: [
            {
              _: 'extractInputStickerSetFromDocumentAttributesAndStore',
              from: {
                _: 'path',
                parts: [
                  {
                    _: 'pathPart',
                    constructor: 'document',
                    param: 'attributes',
                    flag: { _: 'paramNotFlag' },
                  },
                ],
              },
              to: 'stickerset',
            },
          ],
        },
        { current: holder, ...emptyCtx },
      ))?.stickerset,
    ).toMatchObject({ _: 'inputStickerSetID' });

    const set = { className: 'StickerSet', id: bigInt(2), accessHash: bigInt(3) };
    expect(
      (await tryBuildSource(
        {
          stored_constructor: 'fileSourceStickerSet',
          stored_params: [
            {
              _: 'extractInputStickerSetFromStickerSetAndStore',
              from: {
                _: 'path',
                parts: [
                  {
                    _: 'pathPart',
                    constructor: 'stickerSet',
                    param: '',
                    flag: { _: 'paramNotFlag' },
                  },
                ],
              },
              to: 'stickerset',
            },
          ],
        },
        { current: set, ...emptyCtx },
      ))?.stickerset,
    ).toMatchObject({ _: 'inputStickerSetID', id: '2' });
  });

  it('honors needs_parent, skipped flags, abort-if-empty, and fallback', async () => {
    const parents = new Map<string, unknown[]>([['users.getSavedMusic', [{ className: 'users.GetSavedMusic' }]]]);
    expect(
      await tryBuildSource(
        {
          stored_constructor: 'fileSourceSavedMusic',
          stored_params: [],
          needs_parent: { _: 'predicate', predicate: 'missing', is_constructor: false },
        },
        { current: {}, parentContext: parents, getSelfId: async () => '1' },
      ),
    ).toBeUndefined();

    expect(
      await tryBuildSource(
        {
          stored_constructor: 'fileSourceSavedMusic',
          stored_params: [],
          needs_not_parents: [{ _: 'predicate', predicate: 'users.getSavedMusic', is_constructor: false }],
        },
        { current: {}, parentContext: parents, getSelfId: async () => '1' },
      ),
    ).toBeUndefined();

    const built = await tryBuildSource(
      {
        stored_constructor: 'fileSourceMessage',
        stored_params: [],
        skipped_flags: ['quick_reply_shortcut_id'],
      },
      { current: { className: 'Message' }, ...emptyCtx },
    );
    expect(built?.kind).toBe('fileSourceMessage');
    expect(built?.quick_reply_shortcut_id).toBeUndefined();

    expect(
      await tryBuildSource(
        {
          stored_constructor: 'fileSourceWebPage',
          stored_params: [
            {
              _: 'extractAndStore',
              from: {
                _: 'path',
                parts: [
                  {
                    _: 'pathPart',
                    constructor: 'webPage',
                    param: 'url',
                    flag: { _: 'paramIsFlagAbortIfEmpty' },
                  },
                ],
              },
              to: 'url',
            },
          ],
        },
        { current: { className: 'WebPage' }, ...emptyCtx },
      ),
    ).toBeUndefined();

    const withFallback = await tryBuildSource(
      {
        stored_constructor: 'fileSourceUserFull',
        stored_params: [
          {
            _: 'extractUserIdFromInputUserAndStore',
            from: {
              _: 'path',
              parts: [
                {
                  _: 'pathPart',
                  constructor: 'photos.updateProfilePhoto',
                  param: 'bot',
                  flag: {
                    _: 'paramIsFlagFallback',
                    fallback: { _: 'constructorOp', constructor: 'inputUserSelf', args: [] },
                  },
                },
              ],
            },
            to: 'id',
          },
        ],
      },
      {
        current: { className: 'photos.UpdateProfilePhoto' },
        parentContext: new Map(),
        getSelfId: async () => '77',
      },
    );
    expect(withFallback?.id).toBe('77');

    const parentObj = { className: 'users.GetSavedMusic', id: Object.assign(new Api.InputUser({ userId: bigInt(1), accessHash: bigInt(1) }), { className: 'InputUser' }) };
    const fromParent = await tryBuildSource(
      {
        stored_constructor: 'fileSourceSavedMusic',
        stored_params: [
          {
            _: 'extractUserIdFromInputUserAndStore',
            from: {
              _: 'pathParent',
              parts: [
                {
                  _: 'pathPart',
                  constructor: 'users.getSavedMusic',
                  param: 'id',
                  flag: { _: 'paramNotFlag' },
                },
              ],
            },
            to: 'user_id',
          },
        ],
        needs_parent: { _: 'predicate', predicate: 'users.getSavedMusic', is_constructor: false },
      },
      {
        current: { className: 'Document' },
        parentContext: new Map([['users.getSavedMusic', [parentObj]]]),
        getSelfId: async () => undefined,
      },
    );
    expect(fromParent?.user_id).toBe('1');
  });
});

describe('typed-op peer lookups', () => {
  let db: LocalDb;
  afterEach(async () => {
    if (db) {
      try {
        await db.deleteDatabase();
      } catch {
        db.destroy();
      }
    }
  });

  it('resolves input peer/user/channel and vector/literals', async () => {
    db = createDb();
    await db.open();
    await db.putUser({ id: '5', accessHash: '9', firstName: 'A', min: false } as never);
    await db.putChannel({
      id: '-1000000000123',
      accessHash: '8',
      title: 'C',
      photo: {} as never,
      date: 1,
      min: false,
    } as never);
    const ctx = {
      source: { kind: 'fileSourceMessage', peer: '5', user_id: '5', channel: '123', n: 1 },
      localDb: db,
      getSelfId: async () => '5',
    };
    const peer = await evalTypedOp({ _: 'getInputPeerByIdOp', from: 'peer' }, ctx);
    expect(peer).toBeInstanceOf(Api.InputPeerUser);
    const user = await evalTypedOp({ _: 'getInputUserByIdOp', from: 'user_id' }, ctx);
    expect(user).toBeInstanceOf(Api.InputUser);
    const channel = await evalTypedOp({ _: 'getInputChannelByIdOp', from: 'channel' }, ctx);
    expect(channel).toBeInstanceOf(Api.InputChannel);
    await expect(evalTypedOp({ _: 'longLiteralOp', value: 2 }, ctx)).resolves.toBeDefined();
    await expect(evalTypedOp({ _: 'doubleLiteralOp', value: 1.5 }, ctx)).resolves.toBe(1.5);
    await expect(evalTypedOp({ _: 'bytesLiteralOp', value: 'aGk=' }, ctx)).resolves.toBeInstanceOf(Buffer);
    const vec = await evalTypedOp(
      { _: 'vectorOp', values: [{ _: 'intLiteralOp', value: 1 }, { _: 'intLiteralOp', value: 2 }] },
      ctx,
    );
    expect(vec).toEqual([1, 2]);
    await expect(evalFallbackOp({ _: 'intLiteralOp', value: 4 }, async () => '1')).resolves.toBe(4);
    await expect(evalTypedOp({ _: 'getInputPeerByIdOp', from: 'missing' }, ctx)).rejects.toBeInstanceOf(
      ExtractAbort,
    );
  });
});

describe('refresh actions', () => {
  let db: LocalDb;
  afterEach(async () => {
    if (db) {
      try {
        await db.deleteDatabase();
      } catch {
        db.destroy();
      }
    }
  });

  it('runs getMessageOp for users and callOp for web pages', async () => {
    db = createDb();
    await db.open();
    await db.putUser({ id: '5', accessHash: '1', firstName: 'A', min: false } as never);
    await db.putFileSource({
      fileId: 'd:1',
      source: { kind: 'fileSourceWebPage', url: 'https://t.me/a' },
    });
    const invoke = jest.fn().mockResolvedValue(new Api.messages.WebPage({
      webpage: new Api.WebPageEmpty({ id: bigInt(1) }),
    } as never));
    await refreshFileId(
      {
        localDb: db,
        map: indexed,
        client: {} as never,
        getSelfId: async () => '5',
        rawInvoke: invoke,
        incoming: incomingOf(db),
      },
      'd:1',
    );
    expect(invoke).toHaveBeenCalled();
    expect(invoke.mock.calls[0][0]).toBeInstanceOf(Api.messages.GetWebPage);

    await db.putChannel({
      id: '-1000000000123',
      accessHash: '1',
      title: 'C',
      photo: {} as never,
      date: 1,
      min: false,
    } as never);
    await db.putFileSource({
      fileId: 'd:2',
      source: { kind: 'fileSourceMessage', peer: '-1000000000123', id: 9 },
    });
    invoke.mockResolvedValue(new Api.messages.Messages({ messages: [], chats: [], users: [] }));
    await refreshFileId(
      {
        localDb: db,
        map: indexed,
        client: {} as never,
        getSelfId: async () => '5',
        rawInvoke: invoke,
        incoming: incomingOf(db),
      },
      'd:2',
    );
    expect(invoke.mock.calls.at(-1)?.[0]).toBeInstanceOf(Api.channels.GetMessages);

    await db.putFileSource({
      fileId: 'd:3',
      source: { kind: 'fileSourceMessage', peer: '5', id: 4, quick_reply_shortcut_id: 2 },
    });
    await refreshFileId(
      {
        localDb: db,
        map: indexed,
        client: {} as never,
        getSelfId: async () => '5',
        rawInvoke: invoke,
        incoming: incomingOf(db),
      },
      'd:3',
    );
    expect(invoke.mock.calls.at(-1)?.[0]).toBeInstanceOf(Api.messages.GetQuickReplyMessages);
  });
});

describe('engine error paths', () => {
  let db: LocalDb;
  afterEach(async () => {
    if (db) {
      try {
        await db.deleteDatabase();
      } catch {
        db.destroy();
      }
    }
  });

  it('rethrows when refresh cannot recover', async () => {
    db = createDb();
    await db.open();
    const invoke = jest.fn().mockRejectedValue({ errorMessage: 'FILE_REFERENCE_EXPIRED' });
    const client = { invoke, invokeWithSender: invoke, getMe: jest.fn().mockRejectedValue(new Error('no')) };
    const engine = new FileRefEngine({
      localDb: db,
      getClient: () => client as never,
      map: indexed,
    });
    engine.install(client as never);
    const request = new Api.messages.SendMedia({
      peer: new Api.InputPeerUser({ userId: bigInt(1), accessHash: bigInt(1) }),
      media: new Api.InputMediaDocument({
        id: new Api.InputDocument({ id: bigInt(1), accessHash: bigInt(1), fileReference: Buffer.alloc(0) }),
      }),
      message: '',
      randomId: bigInt(1),
    });
    await expect(client.invoke(request)).rejects.toMatchObject({ errorMessage: 'FILE_REFERENCE_EXPIRED' });
    await expect(engine.getSelfId()).resolves.toBeUndefined();
    engine.uninstall();
  });

  it('selects indexed swap locations', async () => {
    const a = new Api.InputDocument({ id: bigInt(1), accessHash: bigInt(1), fileReference: Buffer.from('a') });
    const b = new Api.InputDocument({ id: bigInt(2), accessHash: bigInt(1), fileReference: Buffer.from('b') });
    const request = new Api.messages.SendMultiMedia({
      peer: new Api.InputPeerUser({ userId: bigInt(1), accessHash: bigInt(1) }),
      multiMedia: [
        new Api.InputSingleMedia({ media: new Api.InputMediaDocument({ id: a }), randomId: bigInt(1), message: '' }),
        new Api.InputSingleMedia({ media: new Api.InputMediaDocument({ id: b }), randomId: bigInt(2), message: '' }),
      ],
    });
    const locs = outgoing.collectSwapLocations(request);
    expect(locs.length).toBeGreaterThanOrEqual(2);
    expect(parseFileRefError({ errorMessage: 'FILE_REFERENCE_1_EXPIRED' })?.index).toBe(1);
  });
});
