'use client';

import PeerAvatar from '@/lib/components/peer.avatar';
import { useDialogPeer } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import { formatReactionTimestamp } from '@/lib/utils/date';
import { isPaidReaction } from '@telegenie/libs/foundation/telegram/helpers';
import type {
  TypeMessagePeerReaction,
  TypeReaction,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import { fallbackPeerDisplay, peerProfileDisplay } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';

const ROW_H = 44;

function canonicalEmoticon(value: string): string {
  return value.replace(/\uFE0F/g, '');
}

function displayEmoticon(value: string): string {
  const base = canonicalEmoticon(value);
  if (base === '\u2764' || base === '\u2665') return '\u2764\uFE0F';
  return base;
}

function reactionGlyph(reaction: TypeReaction): string {
  if ('emoticon' in reaction && reaction.emoticon) return displayEmoticon(reaction.emoticon);
  if (isPaidReaction(reaction)) return '⭐';
  if ('documentId' in reaction) return '✦';
  return '👍';
}

type TypePeer = NonNullable<TypeMessagePeerReaction['peerId']>;

function peerIdFromTypePeer(peer?: TypePeer | null): string | undefined {
  if (!peer) return undefined;
  if ('userId' in peer && peer.userId) return String(peer.userId);
  if ('chatId' in peer && peer.chatId) return String(peer.chatId);
  if ('channelId' in peer && peer.channelId) return String(peer.channelId);
  return undefined;
}

const ReactorRow = observer(function ReactorRow({
  item,
  showTime,
}: {
  item: TypeMessagePeerReaction;
  showTime: boolean;
}) {
  const peerId = peerIdFromTypePeer(item.peerId);
  const peer = useDialogPeer(peerId);
  const display = peer ? peerProfileDisplay(peer) : fallbackPeerDisplay(peerId ?? '');
  const name = display.name || peerId || 'Unknown';
  const emoji = reactionGlyph(item.reaction);

  return (
    <li className="group/reactor px-1">
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg px-2 transition-colors',
          'hover:bg-accent/90 group-focus-within/reactor:bg-accent/90',
        )}
        style={{ height: showTime ? 52 : ROW_H }}
      >
        <PeerAvatar
          peerId={peerId}
          display={display}
          photo={peer?.photo}
          className="size-9 shrink-0 text-[10px]"
        />
        {showTime ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm leading-tight">{name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatReactionTimestamp(item.date)}
              </p>
            </div>
            <span className="w-7 shrink-0 text-center text-xl leading-none">{emoji}</span>
          </>
        ) : (
          <div className="relative min-w-0 flex-1 overflow-hidden" style={{ height: ROW_H }}>
            <div
              className={cn(
                'flex flex-col transition-transform duration-200 ease-out motion-reduce:transition-none',
                'group-hover/reactor:-translate-y-1/2 group-focus-within/reactor:-translate-y-1/2',
              )}
              style={{ height: ROW_H * 2 }}
            >
              <div className="flex items-center gap-2" style={{ height: ROW_H }}>
                <span className="min-w-0 flex-1 truncate text-sm leading-tight">{name}</span>
                <span className="w-7 shrink-0 text-center text-xl leading-none">{emoji}</span>
              </div>
              <div
                className="flex items-center truncate text-xs text-muted-foreground"
                style={{ height: ROW_H }}
              >
                {formatReactionTimestamp(item.date)}
              </div>
            </div>
          </div>
        )}
      </div>
    </li>
  );
});

/** Props for {@link MessageReactionReactorsList}. */
export interface MessageReactionReactorsListProps {
  reactions: TypeMessagePeerReaction[];
  loading?: boolean;
  /** Panel sits to the right of the emoji menu when true, otherwise to the left. */
  attachSide?: 'left' | 'right';
  /** Dialog rows show the reaction time. The menu keeps the hover reveal. */
  showTime?: boolean;
  className?: string;
}

/**
 * Full reactor list beside the message context menu (`message.context-menu.tsx`), opened
 * from “N Reacted”. Data from `sdk.messageReaction.getMessageReactionsList`, with
 * `recentReactions` fallback on error. Row hover reveals reacted-at via
 * `formatReactionTimestamp`; `attachSide` flips when the panel would clip the viewport.
 */
export default function MessageReactionReactorsList({
  reactions,
  loading,
  attachSide = 'right',
  showTime = false,
  className,
}: MessageReactionReactorsListProps) {
  return (
    <div
      className={cn(
        'flex flex-col py-1',
        showTime ? 'w-full' : 'w-56 shrink-0',
        !showTime && (attachSide === 'right' ? 'border-l border-border/60' : 'border-r border-border/60'),
        className,
      )}
    >
      <div className={cn('overflow-x-hidden', showTime ? 'max-h-none' : 'max-h-72 overflow-y-auto')}>
        {loading ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
        ) : reactions.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">No reactions</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {reactions.map((item, index) => (
              <ReactorRow
                key={`${peerIdFromTypePeer(item.peerId) ?? 'anon'}-${item.date}-${index}`}
                item={item}
                showTime={showTime}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
