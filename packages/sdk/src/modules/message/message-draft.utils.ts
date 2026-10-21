import type { CustomEmojiEntity } from '@telegenie/libs/foundation/telegram/services/message.service';
import { Dialog } from '../../store/entity/models/dialog.model';
import type { MessageDraft } from '../../store/global/models/thread.state';

export function customEmojiEntities(
  entities: MessageDraft['entities'],
): CustomEmojiEntity[] | undefined {
  const next = (entities ?? []).flatMap((entity) => {
    if (entity.className !== 'MessageEntityCustomEmoji') return [];
    if (!('documentId' in entity) || typeof entity.documentId !== 'string') return [];
    return [{ offset: entity.offset, length: entity.length, documentId: entity.documentId }];
  });
  return next.length ? next : undefined;
}

export function draftThreadKey(peerId: string, threadId: string): string {
  return `${peerId}:${threadId}`;
}

/** Dialog-list copy of a thread draft. `undefined` clears the chat-list draft. */
export function dialogDraftFromMessage(draft: MessageDraft | undefined): Dialog['draft'] | undefined {
  if (!draft) return undefined;
  const replyNum = draft.replyToMsgId != null ? Number(draft.replyToMsgId) : Number.NaN;
  return {
    message: draft.text,
    entities: draft.entities ?? [],
    date: Math.floor(Date.now() / 1000),
    ...(Number.isInteger(replyNum) && replyNum > 0
      ? { replyTo: { replyToMsgId: replyNum } }
      : {}),
  };
}

export function serverMessageDraft(draft: Dialog['draft']): MessageDraft | undefined {
  if (!draft || !('message' in draft) || !draft.message) return undefined;
  const replyTo = draft.replyTo;
  const replyToMsgId =
    replyTo && 'replyToMsgId' in replyTo && replyTo.replyToMsgId > 0
      ? String(replyTo.replyToMsgId)
      : undefined;
  const next: MessageDraft = { text: draft.message };
  if (draft.entities?.length) next.entities = draft.entities;
  if (replyToMsgId) next.replyToMsgId = replyToMsgId;
  return next;
}

export function normalizeDraft(
  draft: MessageDraft | undefined,
  replyingToId: string | undefined,
): MessageDraft | undefined {
  if (!draft || draft.text.length === 0) return undefined;
  const replyToMsgId = draft.replyToMsgId ?? replyingToId;
  const next: MessageDraft = { text: draft.text };
  if (draft.entities?.length) next.entities = draft.entities;
  if (replyToMsgId) next.replyToMsgId = replyToMsgId;
  return next;
}

export function sameDraft(
  left: MessageDraft | undefined,
  right: MessageDraft | undefined,
): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return (
    left.text === right.text &&
    left.replyToMsgId === right.replyToMsgId &&
    JSON.stringify(left.entities ?? []) === JSON.stringify(right.entities ?? [])
  );
}
