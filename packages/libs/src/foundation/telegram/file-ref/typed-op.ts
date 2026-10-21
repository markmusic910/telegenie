import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import {
  buildMarkedPeerIdByType,
  buildMtpPeerId,
  getEntityTypeById,
} from '../helpers/peer-id.helper';
import type { LocalDb } from '../local-db/local-db';
import { toApiInputPeer } from '../local-db/to-api-input-peer';
import type { FileSourceRecord } from '../local-db/types';
import { snakeToCamel } from './names';
import { coerceForApi, ExtractAbort, getApiConstructor } from './tl-value';
import type { JsonMapNode } from './types';

export type TypedOpContext = {
  source: FileSourceRecord;
  localDb: LocalDb;
  getSelfId: () => Promise<string | undefined>;
};

export async function evalTypedOp(node: JsonMapNode | undefined, ctx: TypedOpContext): Promise<unknown> {
  if (!node) return undefined;
  const inner = node._ === 'typedOp' ? (node.op as JsonMapNode) : node;
  const type = node._ === 'typedOp' ? String(node.type ?? '') : '';
  const value = await evalOp(inner, ctx);
  return type ? coerceForApi(value, type) : value;
}

async function evalOp(op: JsonMapNode | undefined, ctx: TypedOpContext): Promise<unknown> {
  if (!op || !op._) return undefined;
  switch (op._) {
    case 'copyOp':
      return ctx.source[String(op.from)];
    case 'getInputPeerByIdOp':
      return getInputPeer(ctx, String(ctx.source[String(op.from)] ?? ''));
    case 'getInputUserByIdOp':
      return getInputUser(ctx, String(ctx.source[String(op.from)] ?? ''));
    case 'getInputChannelByIdOp':
      return getInputChannel(ctx, String(ctx.source[String(op.from)] ?? ''));
    case 'constructorOp':
      return construct(String(op.constructor), (op.args as JsonMapNode[]) ?? [], ctx);
    case 'vectorOp': {
      const values = (op.values as JsonMapNode[]) ?? [];
      const out: unknown[] = [];
      for (const item of values) {
        out.push(await evalTypedOp(item, ctx));
      }
      return out;
    }
    case 'intLiteralOp':
      return Number(op.value);
    case 'longLiteralOp':
      return coerceForApi(op.value, 'long');
    case 'stringLiteralOp':
      return String(op.value ?? '');
    case 'bytesLiteralOp':
      return coerceForApi(op.value, 'bytes');
    case 'boolLiteralOp':
      return Boolean(op.value);
    case 'doubleLiteralOp':
      return Number(op.value);
    case 'themeFormatLiteralOp':
      return '';
    default:
      return undefined;
  }
}

async function construct(predicate: string, args: JsonMapNode[], ctx: TypedOpContext): Promise<unknown> {
  const Ctor = getApiConstructor(predicate);
  const built: Record<string, unknown> = {};
  for (const arg of args) {
    const key = snakeToCamel(String(arg.key ?? ''));
    built[key] = await evalTypedOp(arg.value as JsonMapNode, ctx);
  }
  if (!Ctor) return { _: predicate, ...built };
  return new Ctor(built);
}

export async function evalFallbackOp(
  node: JsonMapNode | undefined,
  getSelfId: () => Promise<string | undefined>,
): Promise<unknown> {
  if (!node) return undefined;
  const dummy: TypedOpContext = {
    source: { kind: '' },
    localDb: null as unknown as LocalDb,
    getSelfId,
  };
  return evalTypedOp(node, dummy);
}

async function getInputPeer(ctx: TypedOpContext, peerId: string): Promise<Api.TypeInputPeer> {
  if (!peerId) throw new ExtractAbort();
  const resolved = await ctx.localDb.resolveInputPeer(peerId);
  const peer = toApiInputPeer(resolved);
  if (!peer) throw new ExtractAbort();
  return peer;
}

async function getInputUser(ctx: TypedOpContext, userId: string): Promise<Api.TypeInputUser> {
  if (!userId) throw new ExtractAbort();
  const resolved = await ctx.localDb.resolveInputPeer(userId);
  if (resolved.type !== 'user') throw new ExtractAbort();
  return new Api.InputUser({
    userId: buildMtpPeerId(userId, 'user'),
    accessHash: bigInt(resolved.accessHash),
  });
}

async function getInputChannel(ctx: TypedOpContext, channelId: string): Promise<Api.TypeInputChannel> {
  if (!channelId) throw new ExtractAbort();
  const marked =
    channelId.startsWith('-') && getEntityTypeById(channelId) === 'channel'
      ? channelId
      : buildMarkedPeerIdByType(channelId, 'channel');
  const resolved = await ctx.localDb.resolveInputPeer(marked);
  if (resolved.type !== 'channel') throw new ExtractAbort();
  return new Api.InputChannel({
    channelId: buildMtpPeerId(marked, 'channel'),
    accessHash: bigInt(resolved.accessHash),
  });
}
