import { Api } from '@telegenie/teleproto';
import { Raw } from '@telegenie/teleproto/events';
import bigInt from 'big-integer';

import { mtpChannelIdFromPeerId, peerIdFromMessage } from '../helpers/peer-id.helper';
import { MSG_ID_BOX_COMMON } from '../local-db/constants';
import type { FileRefEngine } from '../file-ref/engine';
import { LocalDb } from '../local-db/local-db';
import { convertTypeChat } from '../services/converters/chat.converter';
import { convertUser } from '../services/converters/user.converter';
import { handleUpdateEncryption } from '../services/utils/encrypted-chat-handshake.helper';
import type { TransportService } from '../services/transport.service';
import type { TypeChat, TypeUser } from '../types/api-types';
import type { User } from '../types/users';
import { ChannelPoller } from './channel-poll';
import {
  classifyUpdatePts,
  sequenceKeyForPts,
  unwrapEnvelope,
} from './process-envelope';
import type {
  AnyUpdateHandler,
  ChannelDiffResult,
  ControlEvent,
  ControlHandler,
  ControlPayloadMap,
  PendingUpdate,
  SequenceKey,
  UpdateContext,
  UpdateEventMap,
  UpdateHandler,
  UpdateManagerOptions,
  UpdateSource,
} from './types';
import type { UpdateEventKey } from './update-keys';

const DEFAULT_GAP_WAIT_MS = 500;
const DEFAULT_PTS_TOTAL_LIMIT = 10_000;
const DEFAULT_CHANNEL_DIFF_LIMIT = 100;
const DEFAULT_MAX_WATCHED = 10;
/** Telegram rejects `updates.getChannelDifference` with pts=0 (`PERSISTENT_TIMESTAMP_EMPTY`). */
const MIN_CHANNEL_PTS = 1;

type HandlerEntry = {
  builtin?: boolean;
  fn: UpdateHandler<UpdateEventKey>;
};

function isChannelSequence(key: SequenceKey): key is `channel:${string}` {
  return key.startsWith('channel:');
}

function channelIdFromSequence(key: `channel:${string}`): string {
  return key.slice('channel:'.length);
}

function messagesToNewMessageUpdates(
  messages: Api.TypeMessage[],
  channel: boolean,
): Api.TypeUpdate[] {
  return messages
    .filter((m) => !(m instanceof Api.MessageEmpty))
    .map((message) => {
      if (channel) {
        return new Api.UpdateNewChannelMessage({
          message,
          pts: 0,
          ptsCount: 0,
        });
      }
      return new Api.UpdateNewMessage({
        message,
        pts: 0,
        ptsCount: 0,
      });
    });
}

function encryptedToUpdates(messages: Api.TypeEncryptedMessage[]): Api.TypeUpdate[] {
  return messages.map(
    (message) =>
      new Api.UpdateNewEncryptedMessage({
        message,
        qts: 0,
      }),
  );
}

/**
 * Processes Telegram Updates: pts/qts/seq integrity, gap recovery,
 * channel short-poll, and typed multi-handlers per Update constructor.
 */
export class UpdateManager {
  private readonly debug: boolean;
  private readonly transportService: TransportService;
  private readonly localDb: LocalDb;
  private readonly fileRefEngine?: FileRefEngine;
  private readonly gapWaitMs: number;
  private readonly ptsTotalLimit: number;
  private readonly channelDiffLimit: number;
  private readonly maxWatchedChannels: number;

  private readonly handlers = new Map<UpdateEventKey, HandlerEntry[]>();
  private readonly anyHandlers: AnyUpdateHandler[] = [];
  private readonly controlHandlers = new Map<ControlEvent, ControlHandler<ControlEvent>[]>();

  private readonly fetching = new Set<SequenceKey>();
  private readonly postponed = new Map<SequenceKey, PendingUpdate[]>();
  private readonly gapTimers = new Map<SequenceKey, ReturnType<typeof setTimeout>>();

  private readonly channelPoller: ChannelPoller;
  private started = false;
  private eventHandler: ((update: Api.TypeUpdate | Api.TypeUpdates) => void) | null = null;
  private readonly rawEvent = new Raw({});

  constructor(options: UpdateManagerOptions) {
    this.debug = options.debug ?? false;
    this.transportService = options.transportService;
    this.localDb = options.localDb;
    this.fileRefEngine = options.fileRefEngine;
    this.gapWaitMs = options.gapWaitMs ?? DEFAULT_GAP_WAIT_MS;
    this.ptsTotalLimit = options.ptsTotalLimit ?? DEFAULT_PTS_TOTAL_LIMIT;
    this.channelDiffLimit = options.channelDiffLimit ?? DEFAULT_CHANNEL_DIFF_LIMIT;
    this.maxWatchedChannels = options.maxWatchedChannels ?? DEFAULT_MAX_WATCHED;

    this.channelPoller = new ChannelPoller({
      maxWatchedChannels: this.maxWatchedChannels,
      fetchChannelDifference: (channelId, opts) =>
        this.withSequenceLock(`channel:${channelId}`, () =>
          this.fetchChannelDifference(channelId, opts),
        ),
      onWatchLimitReached: (channelId) => {
        this.emitControl('watchLimitReached', {
          channelId,
          maxWatchedChannels: this.maxWatchedChannels,
        });
      },
      log: (...args) => this.log(...args),
    });

    this.registerBuiltins();
  }

  private get client() {
    const client = this.transportService.client;
    if (!client) throw new Error('UpdateManager: TelegramClient not connected');
    return client;
  }

  private log(...args: unknown[]) {
    if (this.debug) console.info('[UpdateManager]', ...args);
  }

  async start(): Promise<void> {
    if (this.started) return;
    const state = await this.localDb.getCommonState();
    if (!state) {
      const remote = await this.client.invoke(new Api.updates.GetState());
      await this.localDb.setCommonState({
        pts: remote.pts,
        qts: remote.qts,
        seq: remote.seq,
        date: remote.date,
      });
    }

    this.eventHandler = (update) => {
      void this.process(update, 'socket');
    };
    this.client.addEventHandler(this.eventHandler, this.rawEvent);
    this.started = true;
    this.log('started');
  }

  stop(): void {
    if (!this.started) return;
    if (this.eventHandler && this.transportService.client) {
      this.transportService.client.removeEventHandler(this.eventHandler, this.rawEvent);
    }
    this.eventHandler = null;
    for (const timer of this.gapTimers.values()) clearTimeout(timer);
    this.gapTimers.clear();
    this.postponed.clear();
    this.fetching.clear();
    this.channelPoller.stop();
    this.started = false;
    this.log('stopped');
  }

  watchChannel(channelId: string): void {
    this.channelPoller.watch(channelId);
  }

  unwatchChannel(channelId: string): void {
    this.channelPoller.unwatch(channelId);
  }

  unwatchAllChannels(): void {
    this.channelPoller.unwatchAll();
  }

  on<K extends keyof UpdateEventMap>(event: K, handler: UpdateHandler<K>): () => void {
    const list = this.handlers.get(event as UpdateEventKey) ?? [];
    const entry: HandlerEntry = { fn: handler as UpdateHandler<UpdateEventKey> };
    list.push(entry);
    this.handlers.set(event as UpdateEventKey, list);
    return () => this.off(event, handler);
  }

  off<K extends keyof UpdateEventMap>(event: K, handler: UpdateHandler<K>): void {
    const list = this.handlers.get(event as UpdateEventKey);
    if (!list) return;
    const next = list.filter((e) => e.fn !== handler);
    this.handlers.set(event as UpdateEventKey, next);
  }

  onAny(handler: AnyUpdateHandler): () => void {
    this.anyHandlers.push(handler);
    return () => {
      const idx = this.anyHandlers.indexOf(handler);
      if (idx >= 0) this.anyHandlers.splice(idx, 1);
    };
  }

  onControl<K extends ControlEvent>(event: K, handler: ControlHandler<K>): () => void {
    const list = this.controlHandlers.get(event) ?? [];
    list.push(handler as ControlHandler<ControlEvent>);
    this.controlHandlers.set(event, list);
    return () => {
      const cur = this.controlHandlers.get(event) ?? [];
      this.controlHandlers.set(
        event,
        cur.filter((h) => h !== handler),
      );
    };
  }

  /** Feed Updates from socket or RPC into the pipeline. */
  async process(
    input: Api.TypeUpdates | Api.TypeUpdate,
    source: UpdateSource = 'rpc',
  ): Promise<void> {
    const unwrapped = unwrapEnvelope(input);
    await this.fileRefEngine?.ingestUpdates(unwrapped.updates);
    const plainUsers = this.convertUsers(unwrapped.users);
    const plainChats = this.convertChats(unwrapped.chats);
    await this.persistEntities(unwrapped.users, unwrapped.chats);

    const ctx: UpdateContext = {
      users: plainUsers,
      chats: plainChats,
      source,
    };

    if (unwrapped.tooLong) {
      this.emitControl('updatesTooLong', {});
      await this.recoverCommon();
      return;
    }

    for (const update of unwrapped.updates) {
      await this.processOne(update, ctx);
    }

    if (unwrapped.seq) {
      await this.applySeqMeta(unwrapped.seq.seqStart, unwrapped.seq.seq, unwrapped.seq.date);
    }

    this.emitControl('batchEnd', {});
  }

  private async processOne(update: Api.TypeUpdate, ctx: UpdateContext): Promise<void> {
    const ptsKind = classifyUpdatePts(update);
    const seqKey = sequenceKeyForPts(ptsKind);

    if (seqKey && this.fetching.has(seqKey)) {
      const q = this.postponed.get(seqKey) ?? [];
      q.push({ update, ctx });
      this.postponed.set(seqKey, q);
      return;
    }

    if (ptsKind.kind === 'channelTooLong') {
      this.emitControl('channelTooLong', {
        channelId: ptsKind.channelId,
        pts: ptsKind.pts,
      });
      await this.dispatch(update, ctx);
      await this.recoverChannel(ptsKind.channelId);
      return;
    }

    if (ptsKind.kind === 'common') {
      const result = await this.localDb.applyCommonPts(ptsKind.pts, ptsKind.ptsCount);
      if (result === 'skip') return;
      if (result === 'gap') {
        this.emitControl('gap', {
          sequence: 'common',
          pts: ptsKind.pts,
          ptsCount: ptsKind.ptsCount,
        });
        await this.scheduleGapRecovery('common', update, ctx);
        return;
      }
    } else if (ptsKind.kind === 'channel') {
      const result = await this.localDb.applyChannelPts(
        ptsKind.channelId,
        ptsKind.pts,
        ptsKind.ptsCount,
      );
      if (result === 'skip') return;
      if (result === 'gap') {
        this.emitControl('gap', {
          sequence: { channelId: ptsKind.channelId },
          pts: ptsKind.pts,
          ptsCount: ptsKind.ptsCount,
        });
        await this.scheduleGapRecovery(`channel:${ptsKind.channelId}`, update, ctx);
        return;
      }
    } else if (ptsKind.kind === 'qts') {
      const result = await this.localDb.applyQts(ptsKind.qts);
      if (result === 'skip') return;
      if (result === 'gap') {
        this.emitControl('gap', { sequence: 'qts', pts: ptsKind.qts });
        await this.scheduleGapRecovery('common', update, ctx);
        return;
      }
    }

    await this.dispatch(update, ctx);
  }

  private async applySeqMeta(seqStart: number, seq: number, date: number): Promise<void> {
    if (this.fetching.has('common')) {
      return;
    }
    const result = await this.localDb.applySeq(seqStart, seq, date);
    if (result === 'skip') return;
    if (result === 'gap') {
      this.emitControl('gap', { sequence: 'seq' });
      await this.recoverCommon();
    }
  }

  private async scheduleGapRecovery(
    key: SequenceKey,
    update: Api.TypeUpdate,
    ctx: UpdateContext,
  ): Promise<void> {
    const q = this.postponed.get(key) ?? [];
    q.push({ update, ctx });
    this.postponed.set(key, q);

    if (this.gapTimers.has(key) || this.fetching.has(key)) return;

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.gapTimers.delete(key);
        void this.runGapRecovery(key).finally(resolve);
      }, this.gapWaitMs);
      this.gapTimers.set(key, timer);
    });
  }

  private async runGapRecovery(key: SequenceKey): Promise<void> {
    // Re-check: a reordered update may have filled the gap already
    const pending = this.postponed.get(key) ?? [];
    if (pending.length === 0) return;

    // Try applying postponed first — if still gap, fetch difference
    const stillGap: PendingUpdate[] = [];
    for (const item of pending) {
      const update = item.update as Api.TypeUpdate;
      const kind = classifyUpdatePts(update);
      let result: 'apply' | 'skip' | 'gap' = 'apply';
      if (kind.kind === 'common') {
        result = await this.localDb.applyCommonPts(kind.pts, kind.ptsCount);
      } else if (kind.kind === 'channel') {
        result = await this.localDb.applyChannelPts(kind.channelId, kind.pts, kind.ptsCount);
      } else if (kind.kind === 'qts') {
        result = await this.localDb.applyQts(kind.qts);
      }
      if (result === 'apply') {
        await this.dispatch(update, item.ctx);
      } else if (result === 'gap') {
        stillGap.push(item);
      }
    }
    this.postponed.set(key, stillGap);
    if (stillGap.length === 0) return;

    // Difference is authoritative for the missed range — drop gap-triggering
    // packets so we don't re-enter recovery with the same stale updates.
    this.postponed.set(key, []);

    if (key === 'common') {
      await this.recoverCommon();
    } else if (isChannelSequence(key)) {
      await this.recoverChannel(channelIdFromSequence(key));
    }
  }

  private async recoverCommon(): Promise<void> {
    // Already inside getDifference (e.g. UpdatePtsChanged in otherUpdates).
    if (this.fetching.has('common')) return;
    await this.withSequenceLock('common', async () => {
      await this.fetchCommonDifference();
    });
  }

  private async recoverChannel(channelId: string): Promise<void> {
    const key = `channel:${channelId}` as const;
    if (this.fetching.has(key)) return;
    await this.withSequenceLock(key, async () => {
      await this.fetchChannelDifference(channelId, { untilFinal: true });
    });
  }

  /** Fetch and apply common updates.getDifference until caught up. */
  private async fetchCommonDifference(): Promise<void> {
     
    while (true) {
      const state = (await this.localDb.getCommonState()) ?? {
        pts: 0,
        qts: 0,
        seq: 0,
        date: 0,
        updatedAt: 0,
      };

      this.log('getDifference', { pts: state.pts, date: state.date, qts: state.qts });
      const diff = await this.client.invoke(
        new Api.updates.GetDifference({
          pts: state.pts,
          date: state.date,
          qts: state.qts,
          ptsTotalLimit: this.ptsTotalLimit,
        }),
      );

      if (diff instanceof Api.updates.DifferenceEmpty) {
        await this.localDb.setCommonState({
          pts: state.pts,
          qts: state.qts,
          seq: diff.seq,
          date: diff.date,
        });
        return;
      }

      if (diff instanceof Api.updates.DifferenceTooLong) {
        this.emitControl('differenceTooLong', { pts: diff.pts });
        await this.localDb.markMsgIdGapUnfillable(MSG_ID_BOX_COMMON);
        const fresh = await this.client.invoke(new Api.updates.GetState());
        await this.localDb.setCommonState({
          pts: fresh.pts,
          qts: fresh.qts,
          seq: fresh.seq,
          date: fresh.date,
        });
        return;
      }

      await this.persistEntities(diff.users, diff.chats);

      const fromMessages = messagesToNewMessageUpdates(diff.newMessages, false);
      const fromEncrypted = encryptedToUpdates(diff.newEncryptedMessages);
      await this.dispatchUpdatesSkippingPts(
        [...fromMessages, ...fromEncrypted, ...diff.otherUpdates],
        'difference',
      );

      if (diff instanceof Api.updates.DifferenceSlice) {
        const mid = diff.intermediateState;
        await this.localDb.setCommonState({
          pts: mid.pts,
          qts: mid.qts,
          seq: mid.seq,
          date: mid.date,
        });
        continue;
      }

      const finalState = (diff as Api.updates.Difference).state;
      await this.localDb.setCommonState({
        pts: finalState.pts,
        qts: finalState.qts,
        seq: finalState.seq,
        date: finalState.date,
      });
      return;
    }
  }

  /**
   * Fetch channel difference. When `untilFinal` is true and result is not final,
   * continues until final (gap recovery). Returns final/timeout for short-poll.
   *
   * Never sends pts=0: Telegram answers `PERSISTENT_TIMESTAMP_EMPTY`. Unknown
   * channels start at {@link MIN_CHANNEL_PTS} (first valid pts), which may yield
   * `ChannelDifferenceTooLong` — already handled below.
   */
  private async fetchChannelDifference(
    channelId: string,
    options: { untilFinal: boolean } = { untilFinal: true },
  ): Promise<ChannelDiffResult> {
    const channel = await this.resolveInputChannel(channelId);
    if (!channel) {
      this.log('fetchChannelDifference: no access hash for', channelId);
      return { final: true };
    }

     
    while (true) {
      const stored = await this.localDb.getChannelPts(channelId);
      const pts = stored && stored > 0 ? stored : MIN_CHANNEL_PTS;
      this.log('getChannelDifference', { channelId, pts });
      let diff: Api.updates.TypeChannelDifference;
      try {
        diff = await this.client.invoke(
          new Api.updates.GetChannelDifference({
            channel,
            filter: new Api.ChannelMessagesFilterEmpty(),
            pts,
            limit: this.channelDiffLimit,
          }),
        );
      } catch (err) {
        if (isPersistentTimestampEmptyError(err)) {
          this.log('fetchChannelDifference: empty pts, skipping', { channelId, pts });
          return { final: true };
        }
        throw err;
      }

      if (diff instanceof Api.updates.ChannelDifferenceTooLong) {
        this.emitControl('channelDifferenceTooLong', { channelId });
        await this.localDb.markMsgIdGapUnfillable(channelId);
        await this.persistEntities(diff.users, diff.chats);
        const dialogPts =
          diff.dialog instanceof Api.Dialog ? diff.dialog.pts : undefined;
        if (typeof dialogPts === 'number') {
          await this.localDb.setChannelPts(channelId, dialogPts);
        }
        const fromMessages = messagesToNewMessageUpdates(diff.messages, true);
        await this.dispatchUpdatesSkippingPts(fromMessages, 'channelDifference');
        return { final: true, timeoutSec: diff.timeout };
      }

      if (diff instanceof Api.updates.ChannelDifferenceEmpty) {
        await this.localDb.setChannelPts(channelId, diff.pts);
        const result = { final: !!diff.final, timeoutSec: diff.timeout };
        if (result.final || !options.untilFinal) return result;
        continue;
      }

      await this.persistEntities(diff.users, diff.chats);
      await this.localDb.setChannelPts(channelId, diff.pts);
      const fromMessages = messagesToNewMessageUpdates(diff.newMessages, true);
      await this.dispatchUpdatesSkippingPts(
        [...fromMessages, ...diff.otherUpdates],
        'channelDifference',
      );

      const result = { final: !!diff.final, timeoutSec: diff.timeout };
      if (result.final || !options.untilFinal) return result;
    }
  }

  private async resolveInputChannel(
    channelId: string,
  ): Promise<Api.InputChannel | undefined> {
    const row = await this.localDb.getChannelRow(channelId);
    const accessHash = row?.entity.accessHash;
    if (!accessHash || row.minAccessHash) return undefined;
    const mtpId = mtpChannelIdFromPeerId(channelId);
    if (!mtpId) return undefined;
    return new Api.InputChannel({
      channelId: mtpId,
      accessHash: bigInt(accessHash),
    });
  }

  private async withSequenceLock<T>(key: SequenceKey, fn: () => Promise<T>): Promise<T> {
    if (this.fetching.has(key)) {
      // Wait for existing fetch by polling postponed flush — serialize via chain
      while (this.fetching.has(key)) {
        await new Promise((r) => setTimeout(r, 20));
      }
    }
    this.fetching.add(key);
    try {
      return await fn();
    } finally {
      this.fetching.delete(key);
      await this.flushPostponed(key);
    }
  }

  private async flushPostponed(key: SequenceKey): Promise<void> {
    const items = this.postponed.get(key) ?? [];
    this.postponed.set(key, []);
    for (const item of items) {
      await this.processOne(item.update as Api.TypeUpdate, item.ctx);
    }
  }

  /** Difference path: skip pts apply (state already set), just dispatch. */
  private async dispatchUpdatesSkippingPts(
    updates: Api.TypeUpdate[],
    source: UpdateSource,
  ): Promise<void> {
    const ctx: UpdateContext = { users: [], chats: [], source };
    for (const update of updates) {
      // Skip synthetic zero-pts wrappers used only to carry messages — still dispatch
      const kind = classifyUpdatePts(update);
      if (
        (kind.kind === 'common' || kind.kind === 'channel') &&
        kind.pts === 0 &&
        kind.ptsCount === 0
      ) {
        await this.dispatch(update, ctx);
        continue;
      }
      if (kind.kind === 'qts' && kind.qts === 0) {
        await this.dispatch(update, ctx);
        continue;
      }
      // otherUpdates from difference may still have pts — apply normally without gap fetch
      if (kind.kind === 'common') {
        const r = await this.localDb.applyCommonPts(kind.pts, kind.ptsCount);
        if (r === 'skip') continue;
        // on gap inside difference, force-set pts forward
        if (r === 'gap') {
          const state = (await this.localDb.getCommonState())!;
          await this.localDb.setCommonState({ ...state, pts: kind.pts });
        }
      } else if (kind.kind === 'channel') {
        const r = await this.localDb.applyChannelPts(kind.channelId, kind.pts, kind.ptsCount);
        if (r === 'skip') continue;
        if (r === 'gap') {
          await this.localDb.setChannelPts(kind.channelId, kind.pts);
        }
      } else if (kind.kind === 'qts') {
        const r = await this.localDb.applyQts(kind.qts);
        if (r === 'skip') continue;
        if (r === 'gap') {
          const state = (await this.localDb.getCommonState())!;
          await this.localDb.setCommonState({ ...state, qts: kind.qts });
        }
      }
      await this.dispatch(update, ctx);
    }
  }

  private async dispatch(update: Api.TypeUpdate, ctx: UpdateContext): Promise<void> {
    const event = update.className as UpdateEventKey;
    const list = this.handlers.get(event) ?? [];
    for (const entry of list) {
      try {
        await entry.fn(update as never, ctx);
      } catch (err) {
        this.log('handler error', event, err);
      }
    }
    for (const handler of this.anyHandlers) {
      try {
        await handler(event, update as never, ctx);
      } catch (err) {
        this.log('onAny error', event, err);
      }
    }
  }

  private emitControl<K extends ControlEvent>(event: K, payload: ControlPayloadMap[K]): void {
    const list = this.controlHandlers.get(event) ?? [];
    for (const handler of list) {
      try {
        void handler(payload as never);
      } catch (err) {
        this.log('control handler error', event, err);
      }
    }
  }

  private convertUsers(users: Api.TypeUser[]): TypeUser[] {
    return users.map((u) => convertUser(u));
  }

  private convertChats(chats: Api.TypeChat[]): TypeChat[] {
    const converted = convertTypeChat(chats);
    return [
      ...converted.chats,
      ...converted.channels,
      ...converted.forbiddenChats,
      ...converted.forbiddenChannels,
      ...converted.emptyChats,
    ];
  }

  private async persistEntities(users: Api.TypeUser[], chats: Api.TypeChat[]): Promise<void> {
    if (users.length) {
      const plain = users.map((u) => convertUser(u)) as User[];
      await this.localDb.putUsers(plain);
    }
    if (chats.length) {
      const converted = convertTypeChat(chats);
      await this.localDb.putChats([
        ...converted.chats,
        ...converted.forbiddenChats,
        ...converted.emptyChats,
      ]);
      await this.localDb.putChannels([
        ...converted.channels,
        ...converted.forbiddenChannels,
      ]);
    }
  }

  private registerBuiltins(): void {
    const addBuiltin = <K extends UpdateEventKey>(event: K, fn: UpdateHandler<K>) => {
      const list = this.handlers.get(event) ?? [];
      list.unshift({ builtin: true, fn: fn as UpdateHandler<UpdateEventKey> });
      this.handlers.set(event, list);
    };

    addBuiltin('UpdateMessageID', async (update) => {
      const randomId = update.randomId?.toString();
      if (randomId) {
        await this.localDb.bindRandomId(randomId, update.id);
      }
    });

    const noteMsg = async (update: {
      message?: Api.TypeMessage;
    }) => {
      const message = update.message;
      if (!message || message instanceof Api.MessageEmpty) return;
      const peerId = peerIdFromMessage(message);
      if (!peerId) return;
      const boxId = LocalDb.msgIdBoxForPeer(peerId);
      await this.localDb.noteMessageId(boxId, message.id);
    };

    addBuiltin('UpdateNewMessage', noteMsg);
    addBuiltin('UpdateEditMessage', noteMsg);
    addBuiltin('UpdateNewChannelMessage', noteMsg);
    addBuiltin('UpdateEditChannelMessage', noteMsg);

    addBuiltin('UpdateEncryption', async (update) => {
      if (!this.localDb) return;
      await handleUpdateEncryption(this.localDb, update.chat);
    });

    addBuiltin('UpdatePtsChanged', async () => {
      await this.recoverCommon();
    });
  }
}

function isPersistentTimestampEmptyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err != null &&
    'errorMessage' in err &&
    (err as { errorMessage?: string }).errorMessage === 'PERSISTENT_TIMESTAMP_EMPTY'
  );
}
