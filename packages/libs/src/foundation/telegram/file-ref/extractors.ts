import { Api } from '@telegenie/teleproto';

import {
  getPeerId,
  markedPeerIdFromApiPeer,
} from '../helpers/peer-id.helper';
import type { FileSourceRecord } from '../local-db/types';
import { evalFallbackOp } from './typed-op';
import {
  ExtractAbort,
  getField,
  isEmptyFlag,
  matchesPredicate,
  readId,
  toStoredValue,
} from './tl-value';
import type { JsonMapNode, PredicateNode } from './types';

export type ExtractContext = {
  current: unknown;
  parentContext: Map<string, unknown[]>;
  getSelfId: () => Promise<string | undefined>;
};

export async function tryBuildSource(
  source: {
    stored_constructor: string;
    stored_params: JsonMapNode[];
    skipped_flags?: string[];
    needs_parent?: PredicateNode;
    needs_not_parents?: PredicateNode[];
  },
  ctx: ExtractContext,
): Promise<FileSourceRecord | undefined> {
  if (source.needs_parent) {
    const parents = ctx.parentContext.get(source.needs_parent.predicate);
    if (!parents?.length) return undefined;
  }
  for (const banned of source.needs_not_parents ?? []) {
    if (ctx.parentContext.get(banned.predicate)?.length) return undefined;
  }

  const record: FileSourceRecord = { kind: source.stored_constructor };
  try {
    for (const extractor of source.stored_params) {
      await applyExtractor(extractor, record, ctx);
    }
  } catch (err) {
    if (err instanceof ExtractAbort) return undefined;
    throw err;
  }
  for (const flag of source.skipped_flags ?? []) {
    delete record[flag];
  }
  return record;
}

async function applyExtractor(
  extractor: JsonMapNode,
  record: FileSourceRecord,
  ctx: ExtractContext,
): Promise<void> {
  const to = String(extractor.to ?? '');
  const from = extractor.from as JsonMapNode | undefined;
  switch (extractor._) {
    case 'extractAndStore':
      record[to] = toStoredValue(await resolvePath(from, ctx));
      return;
    case 'extractPeerIdFromPeerAndStore': {
      const peer = await resolvePath(from, ctx);
      record[to] = peerIdFromPeer(peer);
      return;
    }
    case 'extractPeerIdFromInputPeerAndStore': {
      const input = await resolvePath(from, ctx);
      record[to] = await peerIdFromInputPeer(input, ctx);
      return;
    }
    case 'extractChannelIdFromInputChannelAndStore': {
      const input = await resolvePath(from, ctx);
      record[to] = channelIdFromInputChannel(input);
      return;
    }
    case 'extractChannelIdFromChannelAndStore': {
      const channel = await resolvePath(from, ctx);
      record[to] = readId((channel as { id?: unknown })?.id);
      return;
    }
    case 'extractUserIdFromInputUserAndStore': {
      const input = await resolvePath(from, ctx);
      record[to] = await userIdFromInputUser(input, ctx);
      return;
    }
    case 'extractUserIdFromUserAndStore': {
      const user = await resolvePath(from, ctx);
      record[to] = readId((user as { id?: unknown })?.id);
      return;
    }
    case 'extractInputStickerSetFromDocumentAttributesAndStore': {
      const attrs = await resolvePath(from, ctx);
      record[to] = stickerSetFromAttributes(attrs);
      return;
    }
    case 'extractInputStickerSetFromStickerSetAndStore': {
      const set = await resolvePath(from, ctx);
      record[to] = inputStickerSetFromSet(set);
      return;
    }
    default:
      return;
  }
}

async function resolvePath(path: JsonMapNode | undefined, ctx: ExtractContext): Promise<unknown> {
  if (!path) throw new ExtractAbort();
  const parts = (path.parts as JsonMapNode[]) ?? [];
  let node: unknown =
    path._ === 'pathParent' ? parentObject(ctx, parts) : ctx.current;

  for (const part of parts) {
    if (!matchesPredicate(node, String(part.constructor))) {
      throw new ExtractAbort();
    }
    const param = String(part.param ?? '');
    let value = getField(node, param);
    const flag = (part.flag as JsonMapNode | undefined)?._;
    if (flag === 'paramIsFlagAbortIfEmpty' && isEmptyFlag(value)) {
      throw new ExtractAbort();
    }
    if (flag === 'paramIsFlagFallback' && isEmptyFlag(value)) {
      value = await evalFallbackOp(
        (part.flag as JsonMapNode).fallback as JsonMapNode,
        ctx.getSelfId,
      );
    }
    node = value;
  }
  return node;
}

function parentObject(ctx: ExtractContext, parts: JsonMapNode[]): unknown {
  const first = parts[0];
  const pred = first ? String(first.constructor) : undefined;
  const stack = pred ? ctx.parentContext.get(pred) : undefined;
  const parent = stack?.[stack.length - 1];
  if (parent === undefined) throw new ExtractAbort();
  return parent;
}

function peerIdFromPeer(peer: unknown): string {
  if (!peer || typeof peer !== 'object') throw new ExtractAbort();
  if (
    peer instanceof Api.PeerUser ||
    peer instanceof Api.PeerChat ||
    peer instanceof Api.PeerChannel
  ) {
    return markedPeerIdFromApiPeer(peer);
  }
  throw new ExtractAbort();
}

async function peerIdFromInputPeer(input: unknown, ctx: ExtractContext): Promise<string> {
  if (input instanceof Api.InputPeerEmpty || input == null) throw new ExtractAbort();
  if (input instanceof Api.InputPeerSelf) {
    const selfId = await ctx.getSelfId();
    if (!selfId) throw new ExtractAbort();
    return selfId;
  }
  if (input instanceof Api.InputPeerUser) {
    return getPeerId(new Api.PeerUser({ userId: input.userId }));
  }
  if (input instanceof Api.InputPeerChat) {
    return getPeerId(new Api.PeerChat({ chatId: input.chatId }));
  }
  if (input instanceof Api.InputPeerChannel) {
    return getPeerId(new Api.PeerChannel({ channelId: input.channelId }));
  }
  throw new ExtractAbort();
}

function channelIdFromInputChannel(input: unknown): string {
  if (input instanceof Api.InputChannelEmpty || input == null) throw new ExtractAbort();
  if (input instanceof Api.InputChannel) {
    return input.channelId.toString();
  }
  throw new ExtractAbort();
}

async function userIdFromInputUser(input: unknown, ctx: ExtractContext): Promise<string> {
  if (input instanceof Api.InputUserEmpty || input == null) throw new ExtractAbort();
  if (input instanceof Api.InputUserSelf) {
    const selfId = await ctx.getSelfId();
    if (!selfId) throw new ExtractAbort();
    return selfId;
  }
  if (input instanceof Api.InputUser) {
    return input.userId.toString();
  }
  throw new ExtractAbort();
}

function stickerSetFromAttributes(attrs: unknown): unknown {
  if (!Array.isArray(attrs)) throw new ExtractAbort();
  for (const attr of attrs) {
    if (attr instanceof Api.DocumentAttributeSticker && attr.stickerset) {
      return toStoredValue(attr.stickerset);
    }
  }
  throw new ExtractAbort();
}

function inputStickerSetFromSet(set: unknown): unknown {
  if (!set || typeof set !== 'object') throw new ExtractAbort();
  const rec = set as { id?: unknown; accessHash?: unknown };
  if (rec.id == null || rec.accessHash == null) throw new ExtractAbort();
  return {
    _: 'inputStickerSetID',
    id: readId(rec.id),
    accessHash: readId(rec.accessHash),
  };
}
