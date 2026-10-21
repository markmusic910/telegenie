import { Api } from '@telegenie/teleproto';
import { sleep } from '../../../utils/scheduler/sleep';
import type { LocalDb } from '../local-db/local-db';
import { toApiInputPeer } from '../local-db/to-api-input-peer';
import { ConversionService } from './convert.service';
import type { DialogOrderTracker } from './dialog.order-tracker';
import { persistPeers } from './utils/persist-peers.helper';
import type { TransportService } from './transport.service';

type DialogServiceOptions = {
  debug?: boolean;
  transportService: TransportService;
  localDb?: LocalDb;
  dialogOrderTracker?: DialogOrderTracker;
  flushDialogOrder?: () => void;
};

/**
 * DialogService — network pagination; write-through peers into LocalDb.
 */
export class DialogService {
  private debug: boolean;
  private log: (...args: any) => void;
  transportService: TransportService;
  localDb: LocalDb | undefined;
  dialogOrderTracker: DialogOrderTracker | undefined;
  flushDialogOrder: (() => void) | undefined;
  private conversionService: ConversionService;

  constructor({
    debug,
    transportService,
    localDb,
    dialogOrderTracker,
    flushDialogOrder,
  }: DialogServiceOptions) {
    this.transportService = transportService;
    this.localDb = localDb;
    this.dialogOrderTracker = dialogOrderTracker;
    this.flushDialogOrder = flushDialogOrder;
    this.debug = debug ?? false;
    this.conversionService = new ConversionService({ debug: this.debug });
    this.log = (...args: any) => {
      if (this.debug) {
        console.info('[DialogService]', ...args);
      }
    };
  }

  get client() {
    return this.transportService?.client ?? null;
  }

  /**
   * Page through a Telegram folder. `folderId` 0 is the main list, 1 the archive.
   * Each yielded batch carries the queried `folderId`, because rows returned by
   * a scoped query do not reliably repeat it.
   */
  async *getAllDialogs(folderId = 0): AsyncGenerator<
    ReturnType<ConversionService['convertDialogResponse']> & { folderId: number },
    void,
    unknown
  > {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    let offsetPeer: Api.TypePeer | undefined;
    let offsetDate = 0;
    let count = 0;
    while (true) {
      if (count > 100) {
        break;
      }
      count++;
      const rawResp = await this.client.invoke(
        new Api.messages.GetDialogs({
          // @ts-ignore
          offsetPeer: offsetPeer ?? new Api.InputPeerEmpty(),
          // offsetId: offsetId ? parseInt(offsetId) : 0,
          offsetDate: offsetDate,
          limit: 100,
          folderId: folderId || undefined,
        }),
      );
      if (!rawResp || rawResp instanceof Api.messages.DialogsNotModified) {
        break;
      }
      const resp = rawResp.toJSON() as Api.messages.DialogsSlice;
      const dialogs = (resp.dialogs || []) as Api.TypeDialog[];
      if (dialogs.length === 0) {
        break;
      }
      await sleep(300);

      const converted = this.conversionService.convertDialogResponse(rawResp);
      await persistPeers(this.localDb, {
        users: converted.users ?? [],
        chats: [
          ...(converted.chats ?? []),
          ...(converted.emptyChats ?? []),
          ...(converted.forbiddenChats ?? []),
        ],
        channels: [...(converted.channels ?? []), ...(converted.forbiddenChannels ?? [])],
      });
      await this.seedChannelPtsFromDialogs(converted.dialogs);
      yield { ...converted, folderId };

      const lastDialog = dialogs[dialogs.length - 1];
      if (lastDialog && 'peer' in lastDialog) {
        offsetPeer = (lastDialog as any).peer;
      } else if (lastDialog && 'folder' in lastDialog) {
        offsetPeer = (lastDialog as any).folder?.peer;
      } else {
        break;
      }

      if (lastDialog && 'topMessage' in lastDialog) {
        const topMessageId = (lastDialog as any).topMessage;
        const messages = (resp.messages || []) as Api.Message[];
        const topMsg = messages.find((msg) => msg.id === topMessageId);
        offsetDate = topMsg?.date ?? 0;
      } else {
        offsetDate = 0;
      }
    }
  }

  /**
   * Reorder pinned dialogs for a folder. Resolves every peer first so `force`
   * cannot unpin a chat whose InputPeer could not be built. Applies the new
   * order locally, then invokes MTProto; reverts the tracker if the RPC fails.
   */
  async reorderPinnedDialogs(peerIds: string[], folderId = 0): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const order: Api.TypeInputPeer[] = [];
    for (const peerId of peerIds) {
      const resolved = this.localDb
        ? await this.localDb.resolveInputPeer(peerId)
        : { type: 'unavailable' as const, peerId };
      const input = toApiInputPeer(resolved);
      if (!input) {
        throw new Error(`Cannot resolve InputPeer for ${peerId}`);
      }
      order.push(input);
    }

    const tracker = this.dialogOrderTracker;
    const snapshot = tracker?.pinnedPeerIds(folderId) ?? [];
    tracker?.apply({ type: 'pinnedDialogs', folderId, peerIds });
    this.flushDialogOrder?.();

    try {
      await this.client.invoke(
        new Api.messages.ReorderPinnedDialogs({
          force: true,
          folderId,
          order,
        }),
      );
    } catch (err) {
      tracker?.apply({ type: 'pinnedDialogs', folderId, peerIds: snapshot });
      this.flushDialogOrder?.();
      throw err;
    }
  }

  /** Channel dialogs carry the pts GetChannelDifference needs; persist if unknown. */
  private async seedChannelPtsFromDialogs(
    dialogs: ReturnType<ConversionService['convertDialogResponse']>['dialogs'],
  ): Promise<void> {
    if (!this.localDb) return;
    for (const dialog of dialogs) {
      const peer = dialog.peer;
      if (!peer || !('channelId' in peer) || !peer.channelId) continue;
      if (!(typeof dialog.pts === 'number') || dialog.pts <= 0) continue;
      await this.localDb.seedChannelPts(peer.channelId, dialog.pts);
    }
  }
}
