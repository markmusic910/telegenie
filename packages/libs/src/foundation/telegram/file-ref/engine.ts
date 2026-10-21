import { Api } from '@telegenie/teleproto';
import type { TelegramClient } from '@telegenie/teleproto';

import type { LocalDb } from '../local-db/local-db';
import fileRefMapJson from './file_ref_map.json';
import { IncomingTraverser } from './incoming';
import { indexFileRefMap } from './map-index';
import { OutgoingTraverser } from './outgoing';
import { refreshFileId, type RefreshHint } from './refresh';
import type { FileReferenceMapJson, IndexedFileRefMap } from './types';

const DEFAULT_MAP = indexFileRefMap(fileRefMapJson as FileReferenceMapJson);
const MAX_REFRESH_RETRIES = 3;

type InvokeFn = (request: Api.AnyRequest, ...rest: unknown[]) => Promise<unknown>;

export type FileRefEngineOptions = {
  localDb: LocalDb;
  getClient: () => TelegramClient | null | undefined;
  map?: IndexedFileRefMap;
  getSelfId?: () => Promise<string | undefined>;
};

export class FileRefEngine {
  readonly map: IndexedFileRefMap;
  private readonly localDb: LocalDb;
  private readonly getClient: () => TelegramClient | null | undefined;
  private readonly getSelfIdFn?: () => Promise<string | undefined>;
  private readonly incoming: IncomingTraverser;
  private readonly outgoing: OutgoingTraverser;
  private selfId?: string;
  private originalInvoke?: InvokeFn;
  private originalInvokeWithSender?: InvokeFn;
  private installedOn?: TelegramClient;

  constructor(options: FileRefEngineOptions) {
    this.localDb = options.localDb;
    this.getClient = options.getClient;
    this.map = options.map ?? DEFAULT_MAP;
    this.getSelfIdFn = options.getSelfId;
    this.incoming = new IncomingTraverser({
      localDb: this.localDb,
      map: this.map,
      getSelfId: this.getSelfId,
    });
    this.outgoing = new OutgoingTraverser(this.map);
  }

  getSelfId = async (): Promise<string | undefined> => {
    if (this.getSelfIdFn) return this.getSelfIdFn();
    if (this.selfId) return this.selfId;
    const client = this.getClient();
    if (!client) return undefined;
    try {
      const me = await client.getMe(true);
      const id = (me as { userId?: { toString(): string } })?.userId?.toString();
      if (id) this.selfId = id;
      return id;
    } catch {
      return undefined;
    }
  };

  async ingestUpdates(updates: unknown[]): Promise<void> {
    for (const update of updates) {
      await this.incoming.ingestUpdate(update);
    }
  }

  install(client: TelegramClient): void {
    if (typeof client.invoke !== 'function') return;
    if (this.installedOn === client) return;
    this.uninstall();
    this.originalInvoke = client.invoke.bind(client) as InvokeFn;
    this.originalInvokeWithSender = client.invokeWithSender.bind(client) as InvokeFn;
    client.invoke = ((request: Api.AnyRequest, dcId?: number) =>
      this.wrappedInvoke(this.originalInvoke!, request, dcId)) as TelegramClient['invoke'];
    client.invokeWithSender = ((request: Api.AnyRequest, sender?: unknown) =>
      this.wrappedInvoke(this.originalInvokeWithSender!, request, sender)) as TelegramClient['invokeWithSender'];
    this.installedOn = client;
  }

  uninstall(): void {
    if (!this.installedOn) return;
    if (this.originalInvoke) {
      this.installedOn.invoke = this.originalInvoke as TelegramClient['invoke'];
    }
    if (this.originalInvokeWithSender) {
      this.installedOn.invokeWithSender =
        this.originalInvokeWithSender as TelegramClient['invokeWithSender'];
    }
    this.installedOn = undefined;
    this.originalInvoke = undefined;
    this.originalInvokeWithSender = undefined;
  }

  private rawInvoke = (request: Api.AnyRequest): Promise<unknown> => {
    if (!this.originalInvoke) {
      const client = this.getClient();
      if (!client) throw new Error('FileRefEngine: client not connected');
      return client.invoke(request);
    }
    return this.originalInvoke(request);
  };

  private wrappedInvoke = async (
    inner: InvokeFn,
    request: Api.AnyRequest,
    ...rest: unknown[]
  ): Promise<unknown> => {
    await this.preemptiveSwap(request);
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_REFRESH_RETRIES; attempt++) {
      try {
        const result = await inner(request, ...rest);
        if (!isUpdatesEnvelope(result)) {
          await this.incoming.ingestMethodResult(request, result);
        }
        return result;
      } catch (err) {
        lastError = err;
        const parsed = parseFileRefError(err);
        if (!parsed || attempt === MAX_REFRESH_RETRIES) throw err;
        const locations = this.outgoing.collectSwapLocations(request);
        const location =
          parsed.index === undefined ? locations[0] : locations[parsed.index];
        if (!location) throw err;
        const refreshed = await refreshFileId(
          {
            localDb: this.localDb,
            map: this.map,
            client: this.getClient() as TelegramClient,
            getSelfId: this.getSelfId,
            rawInvoke: this.rawInvoke,
            incoming: this.incoming,
          },
          location.fileId,
        );
        if (!refreshed) throw err;
        const row = await this.localDb.getFileRef(location.fileId);
        if (!row) throw err;
        this.outgoing.applyFileReference(location, row.fileReference);
      }
    }
    throw lastError;
  };

  async refreshFileId(fileId: string, hint?: RefreshHint): Promise<boolean> {
    return refreshFileId(
      {
        localDb: this.localDb,
        map: this.map,
        client: this.getClient() as TelegramClient,
        getSelfId: this.getSelfId,
        rawInvoke: this.rawInvoke,
        incoming: this.incoming,
      },
      fileId,
      hint,
    );
  }

  private async preemptiveSwap(request: Api.AnyRequest): Promise<void> {
    const locations = this.outgoing.collectSwapLocations(request);
    for (const location of locations) {
      const row = await this.localDb.getFileRef(location.fileId);
      if (row?.fileReference) {
        this.outgoing.applyFileReference(location, row.fileReference);
      }
    }
  }
}

export function parseFileRefError(err: unknown): { index?: number } | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const anyErr = err as {
    name?: string;
    errorMessage?: string;
    message?: string;
    value?: number;
  };
  const errorMessage = String(anyErr.errorMessage ?? '');
  const indexed = errorMessage.match(/^FILE_REFERENCE_(\d+)_(EXPIRED|INVALID)$/);
  if (indexed) return { index: Number(indexed[1]) };
  if (
    errorMessage === 'FILE_REFERENCE_EXPIRED' ||
    errorMessage === 'FILE_REFERENCE_INVALID' ||
    errorMessage === 'FILE_REFERENCE_EMPTY'
  ) {
    return {};
  }
  if (anyErr.name === 'FileReferenceExpiredError' || anyErr.name === 'FileReferenceInvalidError') {
    return { index: typeof anyErr.value === 'number' ? anyErr.value : undefined };
  }
  const matchMsg = String(anyErr.message ?? '').match(/file reference(?: of the media file at index (\d+))?.*expired/i);
  if (matchMsg) {
    return { index: matchMsg[1] != null ? Number(matchMsg[1]) : undefined };
  }
  return undefined;
}

export function isUpdatesEnvelope(result: unknown): boolean {
  return (
    result instanceof Api.Updates ||
    result instanceof Api.UpdatesCombined ||
    result instanceof Api.UpdateShort ||
    result instanceof Api.UpdateShortMessage ||
    result instanceof Api.UpdateShortChatMessage ||
    result instanceof Api.UpdateShortSentMessage ||
    result instanceof Api.UpdatesTooLong
  );
}

export { DEFAULT_MAP };
