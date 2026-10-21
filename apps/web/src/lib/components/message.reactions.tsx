'use client';

import PeerAvatar from '@/lib/components/peer.avatar';
import { useDialogPeer, useSDK } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import {
  isPaidReaction,
  reactionKey,
  reactionsEqual,
} from '@telegenie/libs/foundation/telegram/helpers';
import type {
  TypeMessagePeerReaction,
  TypeReaction,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import type { Message } from '@telegenie/sdk';
import { fallbackPeerDisplay, peerProfileDisplay } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';

type TypePeer = NonNullable<TypeMessagePeerReaction['peerId']>;

function reactionLabel(reaction: TypeReaction): string {
  if ('emoticon' in reaction && reaction.emoticon) {
    const base = reaction.emoticon.replace(/\uFE0F/g, '');
    if (base === '\u2764' || base === '\u2665') return '\u2764\uFE0F';
    return base;
  }
  if (isPaidReaction(reaction)) return '⭐';
  if ('documentId' in reaction) return '✦';
  return '👍';
}

function peerIdFromTypePeer(peer?: TypePeer | null): string | undefined {
  if (!peer) return undefined;
  if ('userId' in peer && peer.userId) return String(peer.userId);
  if ('chatId' in peer && peer.chatId) return String(peer.chatId);
  if ('channelId' in peer && peer.channelId) return String(peer.channelId);
  return undefined;
}

function recentReactors(
  reaction: TypeReaction,
  recentReactions?: TypeMessagePeerReaction[],
): string[] {
  const ids: string[] = [];
  for (const item of recentReactions ?? []) {
    if (!reactionsEqual(item.reaction, reaction)) continue;
    const peerId = peerIdFromTypePeer(item.peerId);
    if (!peerId || ids.includes(peerId)) continue;
    ids.push(peerId);
    if (ids.length === 3) break;
  }
  return ids;
}

const pillClass = (chosen: boolean) =>
  cn(
    'inline-flex max-w-full items-center gap-1 rounded-full border-0 py-0.5 text-xs leading-none select-none',
    chosen
      ? 'bg-[#52acf3] pl-1.5 pr-2 text-white shadow-[0_1px_4px_rgba(82,172,243,0.55)] ring-1 ring-[#52acf3]/40'
      : 'bg-[#212121]/78 pl-1.5 pr-1.5 text-white shadow-sm backdrop-blur-[2px] dark:bg-[#212121]/88',
  );

const ReactorAvatar = observer(function ReactorAvatar({ peerId }: { peerId: string }) {
  const reactorPeer = useDialogPeer(peerId);
  const reactorDisplay = reactorPeer
    ? peerProfileDisplay(reactorPeer)
    : fallbackPeerDisplay(peerId);
  return (
    <PeerAvatar
      peerId={peerId}
      display={reactorDisplay}
      photo={reactorPeer?.photo}
      className="size-4 shrink-0 text-[9px]"
    />
  );
});

/** Telegram shows reactor avatars only while the message has at most this many reaction types. */
const MAX_REACTION_TYPES_FOR_AVATARS = 3;

const ReactionPill = observer(function ReactionPill({
  peerId,
  message,
  reaction,
  count,
  chosen,
  reactionTypeCount,
  recentReactions,
}: {
  peerId: string;
  message: Message;
  reaction: TypeReaction;
  count: number;
  chosen: boolean;
  reactionTypeCount: number;
  recentReactions?: TypeMessagePeerReaction[];
}) {
  const sdk = useSDK();
  const paid = isPaidReaction(reaction);
  const showReactorAvatar = count === 1 && reactionTypeCount <= MAX_REACTION_TYPES_FOR_AVATARS;
  const singleReactor = showReactorAvatar
    ? recentReactors(reaction, recentReactions)[0]
    : undefined;
  const showCount =
    count > 1 ||
    (count === 1 && !singleReactor && reactionTypeCount > MAX_REACTION_TYPES_FOR_AVATARS);
  const className = pillClass(chosen);

  const body = (
    <>
      <span className="text-[15px] leading-none">{reactionLabel(reaction)}</span>
      {singleReactor ? (
        <ReactorAvatar peerId={singleReactor} />
      ) : showCount ? (
        <span className="min-w-[1ch] pr-0.5 text-[11px] font-semibold tabular-nums leading-none">
          {count}
        </span>
      ) : null}
    </>
  );

  if (paid || !peerId) {
    return <span className={className}>{body}</span>;
  }

  return (
    <button
      type="button"
      className={cn(className, 'shrink-0 cursor-pointer hover:brightness-105')}
      aria-pressed={chosen}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        void sdk.messageReaction.toggleReaction({
          peerId,
          messageId: message.id,
          reaction,
        });
      }}
    >
      {body}
    </button>
  );
});

/** Props for {@link MessageReactions}. */
export interface MessageReactionsProps {
  peerId: string;
  message: Message;
  className?: string;
}

/**
 * Reaction chips under the message bubble in `message.item.tsx` when `reactions.results`
 * has counts. Click toggles via `sdk.messageReaction.toggleReaction` (no optimistic UI).
 * Mirrors Telegram chip styling, chosen state, paid/custom glyphs, and single-avatar
 * display when there are at most three reaction types on the message.
 */
const MessageReactions = observer(function MessageReactions({
  peerId,
  message,
  className,
}: MessageReactionsProps) {
  const results = message.reactions?.results?.filter((item) => item.count > 0) ?? [];
  if (results.length === 0) return null;

  const recentReactions = message.reactions?.recentReactions;

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {results.map((item) => (
        <ReactionPill
          key={reactionKey(item.reaction)}
          peerId={peerId}
          message={message}
          reaction={item.reaction}
          count={item.count}
          chosen={item.chosenOrder != null && !isPaidReaction(item.reaction)}
          reactionTypeCount={results.length}
          recentReactions={recentReactions}
        />
      ))}
    </div>
  );
});

export default MessageReactions;
