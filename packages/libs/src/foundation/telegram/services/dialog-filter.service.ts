import { Api } from '@telegenie/teleproto';
import { convertDialogFilters, type DialogFilterBatch } from './converters/dialog-filter.converter';
import type { TransportService } from './transport.service';

type DialogFilterServiceOptions = {
  debug?: boolean;
  transportService: TransportService;
  /** Resolves `InputPeerSelf` entries in folder peer lists to a dialog id. */
  getSelfId?: () => Promise<string | undefined>;
};

/**
 * DialogFilterService — chat folder definitions (`messages.dialogFilter`).
 *
 * Only the rules are fetched here. Which dialogs a folder contains is derived
 * on the tab side, since no MTProto method enumerates a folder's chats.
 */
export class DialogFilterService {
  private debug: boolean;
  transportService: TransportService;
  getSelfId: (() => Promise<string | undefined>) | undefined;

  constructor({ debug, transportService, getSelfId }: DialogFilterServiceOptions) {
    this.transportService = transportService;
    this.getSelfId = getSelfId;
    this.debug = debug ?? false;
  }

  get client() {
    return this.transportService?.client ?? null;
  }

  async getDialogFilters(): Promise<DialogFilterBatch> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const raw = await this.client.invoke(new Api.messages.GetDialogFilters());
    let selfId: string | undefined;
    try {
      selfId = await this.getSelfId?.();
    } catch {
      selfId = undefined;
    }
    const batch = convertDialogFilters(raw, selfId);
    if (this.debug) {
      console.info('[DialogFilterService] fetched folders', batch.order);
    }
    return batch;
  }

  /** Persist folder order. `order` holds server folder ids; `0` is All Chats. */
  async reorderDialogFilters(order: number[]): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    await this.client.invoke(new Api.messages.UpdateDialogFiltersOrder({ order }));
  }
}
