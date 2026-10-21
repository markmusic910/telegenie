import { Api } from '@telegenie/teleproto';
import { buildMtpPeerId, buildPeer, getEntityTypeById } from '../../helpers';
import type { LocalDb } from '../../local-db/local-db';
import { toApiInputPeer } from '../../local-db/to-api-input-peer';
import type { TransportService } from '../transport.service';

export async function resolveInputPeerForRead(
  chatId: string,
  transportService: TransportService,
  localDb: LocalDb | undefined,
): Promise<Api.TypeInputPeer> {
  const client = transportService?.client ?? null;
  const resolved = await localDb?.resolveInputPeer(chatId);
  const fromDb = resolved ? toApiInputPeer(resolved) : undefined;
  if (fromDb) {
    return fromDb;
  }

  const peerType = getEntityTypeById(chatId);
  if (peerType === 'chat') {
    return new Api.InputPeerChat({
      chatId: buildMtpPeerId(chatId, 'chat'),
    });
  }

  if (client && typeof (client as { getInputEntity?: (id: string) => Promise<unknown> }).getInputEntity === 'function') {
    try {
      const entity = await (client as { getInputEntity: (id: string) => Promise<Api.TypeInputPeer> }).getInputEntity(chatId);
      if (entity) return entity;
    } catch {
      // fall through
    }
  }

  if (!localDb) {
    return buildPeer(chatId) as unknown as Api.TypeInputPeer;
  }

  throw new Error(`Cannot resolve peer for read: ${chatId}`);
}
