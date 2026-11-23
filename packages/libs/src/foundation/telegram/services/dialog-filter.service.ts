import { Api } from '@telegenie/teleproto';
import bigint from 'big-integer';
import type { LocalDb } from '../local-db';
import {
  convertDialogFilters,
  type DialogFilterBatch,
  type SaveFolderFilterInput,
} from './converters/dialog-filter.converter';
import type { TransportService } from './transport.service';
import { resolveInputPeerForRead } from './utils/resolve-input-peer-for-read';

type DialogFilterServiceOptions = {
  debug?: boolean;
  transportService: TransportService;
  localDb?: LocalDb;
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
  localDb: LocalDb | undefined;
  getSelfId: (() => Promise<string | undefined>) | undefined;

  constructor({ debug, transportService, localDb, getSelfId }: DialogFilterServiceOptions) {
    this.transportService = transportService;
    this.localDb = localDb;
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

  /** Create or update a chat folder (`messages.updateDialogFilter`). */
  async saveDialogFilter(input: SaveFolderFilterInput): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const resolvePeers = async (peerIds: string[]): Promise<Api.TypeInputPeer[]> => {
      const resolved: Api.TypeInputPeer[] = [];
      for (const peerId of peerIds) {
        try {
          const peer = await resolveInputPeerForRead(peerId, this.transportService, this.localDb);
          resolved.push(peer);
        } catch (err) {
          if (this.debug) {
            console.warn('[DialogFilterService] failed to resolve peer for folder', peerId, err);
          }
        }
      }
      return resolved;
    };

    const [pinnedPeers, includePeers, excludePeers] = await Promise.all([
      resolvePeers(input.pinnedPeerIds),
      resolvePeers(input.includePeerIds),
      input.isChatlist ? Promise.resolve([]) : resolvePeers(input.excludePeerIds),
    ]);

    const titleEntities = (input.titleEntities ?? []).map(
      (entity) =>
        new Api.MessageEntityCustomEmoji({
          offset: entity.offset,
          length: entity.length,
          documentId: bigint(entity.documentId),
        }),
    );

    const title = new Api.TextWithEntities({
      text: input.title,
      entities: titleEntities,
    });

    const filter = input.isChatlist
      ? new Api.DialogFilterChatlist({
          id: input.id,
          title,
          titleNoanimate: input.titleNoanimate || undefined,
          emoticon: input.emoticon || undefined,
          color: input.color,
          pinnedPeers,
          includePeers,
        })
      : new Api.DialogFilter({
          id: input.id,
          title,
          titleNoanimate: input.titleNoanimate || undefined,
          emoticon: input.emoticon || undefined,
          color: input.color,
          contacts: input.contacts || undefined,
          nonContacts: input.nonContacts || undefined,
          groups: input.groups || undefined,
          broadcasts: input.broadcasts || undefined,
          bots: input.bots || undefined,
          excludeMuted: input.excludeMuted || undefined,
          excludeRead: input.excludeRead || undefined,
          excludeArchived: input.excludeArchived || undefined,
          pinnedPeers,
          includePeers,
          excludePeers,
        });

    await this.client.invoke(
      new Api.messages.UpdateDialogFilter({
        id: input.id,
        filter,
      }),
    );
  }

  /** Delete a custom chat folder (`messages.updateDialogFilter` with no filter). */
  async deleteDialogFilter(id: number): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    await this.client.invoke(new Api.messages.UpdateDialogFilter({ id }));
  }

  /** Toggle folder tags in the chat list (`messages.toggleDialogFilterTags`). */
  async toggleDialogFilterTags(enabled: boolean): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    await this.client.invoke(new Api.messages.ToggleDialogFilterTags({ enabled }));
  }
}
