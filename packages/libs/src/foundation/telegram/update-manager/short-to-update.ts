import { Api } from '@telegenie/teleproto';

/**
 * Expand redundant short Updates constructors into UpdateNewMessage
 * (per https://core.telegram.org/api/updates — transform to updateShort / full update).
 */
export function shortMessageToUpdateNewMessage(
  short: Api.UpdateShortMessage,
): Api.UpdateNewMessage {
  const peer = new Api.PeerUser({ userId: short.userId });
  const fromId = short.out ? undefined : peer;
  const message = new Api.Message({
    id: short.id,
    peerId: peer,
    fromId,
    message: short.message,
    date: short.date,
    out: short.out,
    mentioned: short.mentioned,
    mediaUnread: short.mediaUnread,
    silent: short.silent,
    fwdFrom: short.fwdFrom,
    viaBotId: short.viaBotId,
    replyTo: short.replyTo,
    entities: short.entities,
    ttlPeriod: short.ttlPeriod,
  });
  return new Api.UpdateNewMessage({
    message,
    pts: short.pts,
    ptsCount: short.ptsCount,
  });
}

export function shortChatMessageToUpdateNewMessage(
  short: Api.UpdateShortChatMessage,
): Api.UpdateNewMessage {
  const peer = new Api.PeerChat({ chatId: short.chatId });
  const fromId = new Api.PeerUser({ userId: short.fromId });
  const message = new Api.Message({
    id: short.id,
    peerId: peer,
    fromId,
    message: short.message,
    date: short.date,
    out: short.out,
    mentioned: short.mentioned,
    mediaUnread: short.mediaUnread,
    silent: short.silent,
    fwdFrom: short.fwdFrom,
    viaBotId: short.viaBotId,
    replyTo: short.replyTo,
    entities: short.entities,
    ttlPeriod: short.ttlPeriod,
  });
  return new Api.UpdateNewMessage({
    message,
    pts: short.pts,
    ptsCount: short.ptsCount,
  });
}

/**
 * UpdateShortSentMessage has no peer — keep as a pts-bearing synthetic update
 * dispatched under UpdateNewMessage only when a peer is known; otherwise return
 * a minimal UpdateNewMessage with MessageEmpty so pts is still applied.
 */
export function shortSentMessageToUpdateNewMessage(
  short: Api.UpdateShortSentMessage,
  peerId?: Api.TypePeer,
  text?: string,
  replyToMsgId?: number,
): Api.UpdateNewMessage {
  const message = peerId
    ? new Api.Message({
        id: short.id,
        peerId,
        message: text ?? '',
        date: short.date,
        out: short.out ?? true,
        media: short.media,
        entities: short.entities,
        ttlPeriod: short.ttlPeriod,
        ...(replyToMsgId != null && replyToMsgId > 0
          ? { replyTo: new Api.MessageReplyHeader({ replyToMsgId }) }
          : {}),
      })
    : new Api.MessageEmpty({ id: short.id });
  return new Api.UpdateNewMessage({
    message,
    pts: short.pts,
    ptsCount: short.ptsCount,
  });
}

export function isShortUpdates(
  value: unknown,
): value is
  | Api.UpdateShortMessage
  | Api.UpdateShortChatMessage
  | Api.UpdateShortSentMessage
  | Api.UpdateShort {
  return (
    value instanceof Api.UpdateShortMessage ||
    value instanceof Api.UpdateShortChatMessage ||
    value instanceof Api.UpdateShortSentMessage ||
    value instanceof Api.UpdateShort
  );
}
