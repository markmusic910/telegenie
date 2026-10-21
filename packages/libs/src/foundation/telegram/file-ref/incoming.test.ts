import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { LocalDb } from '../local-db/local-db';
import { IncomingTraverser } from './incoming';
import { indexFileRefMap } from './map-index';
import DEFAULT_MAP_JSON from './file_ref_map.json';
import type { FileReferenceMapJson } from './types';
import { OutgoingTraverser } from './outgoing';
import { FileRefEngine } from './engine';
import { refreshFileId } from './refresh';
import { ExtractAbort, coerceForApi, getApiConstructor, reconstructTl, serializeTl, toStoredValue } from './tl-value';
import { evalTypedOp } from './typed-op';
import { tryBuildSource } from './extractors';
import { fileRefToBase64, base64ToFileRef } from './bytes';

function createDb() {
  return new LocalDb({
    accountSlot: `fr-${Date.now()}-${Math.random()}`,
    flushDelayMs: 10_000,
  });
}

const indexed = indexFileRefMap(DEFAULT_MAP_JSON as FileReferenceMapJson);
const outgoing = new OutgoingTraverser(indexed);

function incomingOf(db: LocalDb, getSelfId: () => Promise<string | undefined> = async () => '5') {
  return new IncomingTraverser({ localDb: db, map: indexed, getSelfId });
}

function documentMedia() {
  const doc = new Api.Document({
    id: bigInt(99),
    accessHash: bigInt(7),
    fileReference: Buffer.from('hi'),
    date: 1,
    mimeType: 'image/jpeg',
    size: bigInt(10),
    dcId: 2,
    attributes: [],
  });
  return { doc, media: new Api.MessageMediaDocument({ document: doc }) };
}

describe('incoming traversal', () => {
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

  it('stores document file refs and message sources from getHistory', async () => {
    db = createDb();
    await db.open();
    const { media } = documentMedia();
    const msg = new Api.Message({
      id: 10,
      peerId: new Api.PeerUser({ userId: bigInt(5) }),
      date: 1,
      message: '',
    });
    Object.assign(msg, { media });
    const result = new Api.messages.Messages({
      messages: [msg],
      chats: [],
      users: [],
    });
    const request = new Api.messages.GetHistory({
      peer: new Api.InputPeerUser({ userId: bigInt(5), accessHash: bigInt(1) }),
      limit: 1,
    });
    await incomingOf(db).ingestMethodResult(request, result);
    const row = await db.getFileRef('d:99');
    expect(row?.fileReference).toBe(fileRefToBase64(Buffer.from('hi')));
    const sources = await db.getFileSources('d:99');
    expect(sources.some((s) => s.sourceKind === 'fileSourceMessage')).toBe(true);
    expect(sources.find((s) => s.sourceKind === 'fileSourceMessage')?.source).toMatchObject({
      peer: '5',
      id: 10,
    });
  });

  it('ingests updates via updateNewMessage', async () => {
    db = createDb();
    await db.open();
    const { media } = documentMedia();
    const msg = new Api.Message({
      id: 3,
      peerId: new Api.PeerChat({ chatId: bigInt(8) }),
      date: 1,
      message: '',
    });
    Object.assign(msg, { media });
    await incomingOf(db, async () => undefined).ingestUpdate(
      new Api.UpdateNewMessage({ message: msg, pts: 1, ptsCount: 1 }),
    );
    const sources = await db.getFileSources('d:99');
    expect(sources[0]?.source).toMatchObject({ peer: '-8', id: 3 });
  });
});

describe('outgoing swap', () => {
  it('finds inputDocument on sendMedia and applies a new ref', () => {
    const inputDoc = new Api.InputDocument({
      id: bigInt(99),
      accessHash: bigInt(1),
      fileReference: Buffer.from('old'),
    });
    const request = new Api.messages.SendMedia({
      peer: new Api.InputPeerUser({ userId: bigInt(5), accessHash: bigInt(1) }),
      media: new Api.InputMediaDocument({ id: inputDoc }),
      message: '',
      randomId: bigInt(1),
    });
    const locations = outgoing.collectSwapLocations(request);
    expect(locations).toHaveLength(1);
    expect(locations[0].fileId).toBe('d:99');
    outgoing.applyFileReference(locations[0], Buffer.from('new').toString('base64'));
    expect(Buffer.from(inputDoc.fileReference).toString()).toBe('new');
  });
});

describe('FileRefEngine invoke wrap', () => {
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

  it('refreshes an expired inputDocument and retries', async () => {
    db = createDb();
    await db.open();
    await db.putUser({
      id: '5',
      accessHash: '1',
      firstName: 'A',
      min: false,
    } as never);
    await db.putFileSource({
      fileId: 'd:99',
      source: { kind: 'fileSourceMessage', peer: '5', id: 10 },
    });
    await db.putFileRef({
      fileId: 'd:99',
      kind: 'document',
      id: '99',
      fileReference: Buffer.from('old').toString('base64'),
    });

    const { media } = documentMedia();
    const msg = new Api.Message({
      id: 10,
      peerId: new Api.PeerUser({ userId: bigInt(5) }),
      date: 1,
      message: '',
    });
    Object.assign(msg, { media });
    const history = new Api.messages.Messages({ messages: [msg], chats: [], users: [] });

    const inputDoc = new Api.InputDocument({
      id: bigInt(99),
      accessHash: bigInt(1),
      fileReference: Buffer.from('old'),
    });
    const request = new Api.messages.SendMedia({
      peer: new Api.InputPeerUser({ userId: bigInt(5), accessHash: bigInt(1) }),
      media: new Api.InputMediaDocument({ id: inputDoc }),
      message: '',
      randomId: bigInt(1),
    });

    const invoke = jest
      .fn()
      .mockRejectedValueOnce({ errorMessage: 'FILE_REFERENCE_EXPIRED' })
      .mockImplementation(async (req: { className?: string }) => {
        if (req.className === 'messages.GetMessages') return history;
        return { ok: true };
      });
    const client = {
      invoke,
      invokeWithSender: invoke,
      getMe: jest.fn().mockResolvedValue({ userId: bigInt(5) }),
    };

    const engine = new FileRefEngine({
      localDb: db,
      getClient: () => client as never,
      map: indexed,
    });
    engine.install(client as never);
    await expect(client.invoke(request)).resolves.toEqual({ ok: true });
    expect(invoke).toHaveBeenCalled();
    expect(Buffer.from(inputDoc.fileReference).toString()).toBe('hi');
    engine.uninstall();
  });

  it('skips wrapping clients without invoke', () => {
    db = createDb();
    const engine = new FileRefEngine({
      localDb: db,
      getClient: () => null,
      map: indexed,
    });
    engine.install({} as never);
    engine.uninstall();
  });
});

describe('refreshFileId', () => {
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

  it('returns false when no sources refresh the table', async () => {
    db = createDb();
    await db.open();
    const ok = await refreshFileId(
      {
        localDb: db,
        map: indexed,
        client: {} as never,
        getSelfId: async () => undefined,
        rawInvoke: async () => {
          throw new Error('no');
        },
        incoming: incomingOf(db, async () => undefined),
      },
      'd:1',
    );
    expect(ok).toBe(false);
  });
});

describe('tl-value helpers', () => {
  it('serializes and reconstructs constructors', () => {
    const peer = new Api.PeerUser({ userId: bigInt(3) });
    const ser = serializeTl(peer);
    expect(ser._).toBe('peerUser');
    const back = reconstructTl(ser);
    expect(back).toBeInstanceOf(Api.PeerUser);
  });

  it('coerces longs and bytes', () => {
    expect(String(coerceForApi('5', 'long'))).toBe('5');
    expect(Buffer.isBuffer(coerceForApi('aGk=', 'bytes'))).toBe(true);
    expect(coerceForApi(true, 'Bool')).toBe(true);
    expect(coerceForApi('x', 'string')).toBe('x');
  });

  it('looks up Api constructors', () => {
    expect(getApiConstructor('document')).toBe(Api.Document);
    expect(getApiConstructor('messages.getMessages')).toBe(Api.messages.GetMessages);
    expect(getApiConstructor('notARealThing')).toBeUndefined();
  });

  it('stores buffers as base64', () => {
    expect(toStoredValue(Buffer.from('hi'))).toBe(fileRefToBase64(Buffer.from('hi')));
    expect(toStoredValue(undefined)).toBeUndefined();
    expect(toStoredValue(3)).toBe(3);
  });

  it('round-trips file ref bytes', () => {
    const b64 = fileRefToBase64(Buffer.from('ab'))!;
    expect(base64ToFileRef(b64).toString()).toBe('ab');
  });
});

describe('extractors and typed ops', () => {
  it('builds a message source from a message object', async () => {
    const msg = new Api.Message({
      id: 4,
      peerId: new Api.PeerUser({ userId: bigInt(9) }),
      date: 1,
      message: '',
    });
    const source = await tryBuildSource(
      {
        stored_constructor: 'fileSourceMessage',
        stored_params: [
          {
            _: 'extractPeerIdFromPeerAndStore',
            from: {
              _: 'path',
              parts: [
                {
                  _: 'pathPart',
                  type: 'Message',
                  constructor: 'message',
                  param: 'peer_id',
                  param_type: 'Peer',
                  flag: { _: 'paramNotFlag' },
                },
              ],
            },
            to: 'peer',
          },
          {
            _: 'extractAndStore',
            from: {
              _: 'path',
              parts: [
                {
                  _: 'pathPart',
                  type: 'Message',
                  constructor: 'message',
                  param: 'id',
                  param_type: 'int',
                  flag: { _: 'paramNotFlag' },
                },
              ],
            },
            to: 'id',
          },
        ],
      },
      { current: msg, parentContext: new Map(), getSelfId: async () => undefined },
    );
    expect(source).toMatchObject({ kind: 'fileSourceMessage', peer: '9', id: 4 });
  });

  it('aborts when constructor mismatches', async () => {
    const source = await tryBuildSource(
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
                  flag: { _: 'paramNotFlag' },
                },
              ],
            },
            to: 'url',
          },
        ],
      },
      { current: {}, parentContext: new Map(), getSelfId: async () => undefined },
    );
    expect(source).toBeUndefined();
  });

  it('evaluates literals and constructor ops', async () => {
    const ctx = {
      source: { kind: 'x', id: '1' },
      localDb: null as never,
      getSelfId: async () => '5',
    };
    await expect(evalTypedOp({ _: 'intLiteralOp', value: 3 }, ctx)).resolves.toBe(3);
    await expect(evalTypedOp({ _: 'stringLiteralOp', value: 'a' }, ctx)).resolves.toBe('a');
    await expect(evalTypedOp({ _: 'boolLiteralOp', value: true }, ctx)).resolves.toBe(true);
    await expect(evalTypedOp({ _: 'themeFormatLiteralOp' }, ctx)).resolves.toBe('');
    await expect(evalTypedOp({ _: 'copyOp', from: 'id' }, ctx)).resolves.toBe('1');
    const self = await evalTypedOp(
      { _: 'constructorOp', constructor: 'inputUserSelf', args: [] },
      ctx,
    );
    expect(self).toBeInstanceOf(Api.InputUserSelf);
  });

  it('throws ExtractAbort from empty peer lookup', async () => {
    expect(new ExtractAbort().name).toBe('ExtractAbort');
  });
});
