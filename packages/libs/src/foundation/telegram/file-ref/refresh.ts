import { Api } from '@telegenie/teleproto';
import type { TelegramClient } from '@telegenie/teleproto';

import type { LocalDb } from '../local-db/local-db';
import type { FileSourceRecord } from '../local-db/types';
import type { IncomingTraverser } from './incoming';
import { snakeToCamel } from './names';
import { ExtractAbort, getApiConstructor } from './tl-value';
import type { IndexedFileRefMap, JsonMapNode } from './types';
import { evalTypedOp, type TypedOpContext } from './typed-op';

export type RefreshDeps = {
  localDb: LocalDb;
  map: IndexedFileRefMap;
  client: TelegramClient;
  getSelfId: () => Promise<string | undefined>;
  rawInvoke: (request: Api.AnyRequest) => Promise<unknown>;
  incoming: IncomingTraverser;
};

import { toApiInputPeer } from '../local-db/to-api-input-peer';

export type RefreshHint = {
  peerId?: string;
  messageId?: number;
};

export async function refreshFileId(
  deps: RefreshDeps,
  fileId: string,
  hint?: RefreshHint,
): Promise<boolean> {
  const before = (await deps.localDb.getFileRef(fileId))?.fileReference;
  const sources = await deps.localDb.getFileSources(fileId);
  for (const row of sources) {
    const action = deps.map.refreshByKind.get(row.sourceKind);
    if (!action) continue;
    try {
      const { request, result } = await runAction(deps, row.source, action.action);
      if (request && result !== undefined) {
        await deps.incoming.ingestMethodResult(request, result);
      }
    } catch (err) {
      if (err instanceof ExtractAbort) continue;
      continue;
    }
    const after = (await deps.localDb.getFileRef(fileId))?.fileReference;
    if (after && (before ? after !== before : true)) return true;
  }

  // Fallback: If no sources or sources did not refresh the file, use hint if provided
  if (hint?.peerId && hint?.messageId) {
    try {
      await refreshFromMessageHint(deps, hint.peerId, hint.messageId);
      const after = (await deps.localDb.getFileRef(fileId))?.fileReference;
      if (after && (before ? after !== before : true)) return true;
    } catch (err) {
      if (!(err instanceof ExtractAbort)) {
        console.warn(`[refreshFileId] refreshFromMessageHint failed for ${fileId}:`, err);
      }
    }
  }

  return false;
}

async function refreshFromMessageHint(
  deps: RefreshDeps,
  peerId: string,
  messageId: number,
): Promise<void> {
  const resolved = await deps.localDb.resolveInputPeer(peerId);
  const peer = toApiInputPeer(resolved);
  let request: Api.AnyRequest;
  if (peer instanceof Api.InputPeerChannel) {
    request = new Api.channels.GetMessages({
      channel: new Api.InputChannel({
        channelId: peer.channelId,
        accessHash: peer.accessHash,
      }),
      id: [new Api.InputMessageID({ id: messageId })],
    });
  } else {
    request = new Api.messages.GetMessages({
      id: [new Api.InputMessageID({ id: messageId })],
    });
  }
  const result = await deps.rawInvoke(request);
  if (result !== undefined) {
    await deps.incoming.ingestMethodResult(request, result);
  }
}

async function runAction(
  deps: RefreshDeps,
  source: FileSourceRecord,
  action: JsonMapNode,
): Promise<{ request?: Api.AnyRequest; result?: unknown }> {
  const ctx: TypedOpContext = {
    source,
    localDb: deps.localDb,
    getSelfId: deps.getSelfId,
  };
  if (action._ === 'getMessageOp') {
    return runGetMessage(deps, ctx, action);
  }
  if (action._ === 'callOp') {
    return runCallOp(deps, ctx, action);
  }
  return {};
}

async function runCallOp(
  deps: RefreshDeps,
  ctx: TypedOpContext,
  action: JsonMapNode,
): Promise<{ request?: Api.AnyRequest; result?: unknown }> {
  const method = String(action.method ?? '');
  const args = (action.args as JsonMapNode[]) ?? [];
  const built: Record<string, unknown> = {};
  for (const arg of args) {
    const key = String(arg.key ?? '');
    built[snakeToCamel(key)] = await evalTypedOp(arg.value as JsonMapNode, ctx);
  }
  const Ctor = getApiConstructor(method);
  if (!Ctor) throw new ExtractAbort();
  const request = new Ctor(built) as Api.AnyRequest;
  const result = await deps.rawInvoke(request);
  return { request, result };
}

async function runGetMessage(
  deps: RefreshDeps,
  ctx: TypedOpContext,
  action: JsonMapNode,
): Promise<{ request?: Api.AnyRequest; result?: unknown }> {
  const peer = (await evalTypedOp(action.peer as JsonMapNode, ctx)) as Api.TypeInputPeer;
  const id = Number(await evalTypedOp(action.id as JsonMapNode, ctx));
  const quick = await evalTypedOp(action.quick_reply_shortcut_id as JsonMapNode, ctx);

  let request: Api.AnyRequest;
  if (quick !== undefined && quick !== null) {
    request = new Api.messages.GetQuickReplyMessages({
      shortcutId: Number(quick),
      id: [id],
    });
  } else if (peer instanceof Api.InputPeerChannel) {
    request = new Api.channels.GetMessages({
      channel: new Api.InputChannel({
        channelId: peer.channelId,
        accessHash: peer.accessHash,
      }),
      id: [new Api.InputMessageID({ id })],
    });
  } else {
    request = new Api.messages.GetMessages({
      id: [new Api.InputMessageID({ id })],
    });
  }
  const result = await deps.rawInvoke(request);
  return { request, result };
}
