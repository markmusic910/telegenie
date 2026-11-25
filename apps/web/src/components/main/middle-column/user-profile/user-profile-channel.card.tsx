'use client';

import { resolvePersonalChannelPeerId } from '@telegenie/libs/foundation/telegram/helpers';
import {
  collectAlbumPreview,
  fallbackPeerDisplay,
  peerProfileDisplay,
} from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo } from 'react';

import MessageSummary from '@/lib/components/message.summary';
import PeerAvatar from '@/lib/components/peer.avatar';
import PeerTitle from '@/lib/components/peer.title';
import { useMessage, useSDK, useStoreEntities } from '@/lib/contexts/sdk.context';
import { useSelectDialog } from '@/lib/hooks/use-select-dialog';
import { formatPastTimeShort } from '@/lib/utils/date';
import { formatCompactNumber } from '@/lib/utils/format';

export interface UserProfileChannelCardProps {
  personalChannelId: string;
  personalChannelMessageId?: number;
}

const UserProfileChannelCard = observer(function UserProfileChannelCard({
  personalChannelId,
  personalChannelMessageId,
}: UserProfileChannelCardProps) {
  const sdk = useSDK();
  const selectDialog = useSelectDialog();
  const channelPeerId = useMemo(
    () => resolvePersonalChannelPeerId(personalChannelId),
    [personalChannelId],
  );

  const channel = useStoreEntities('channel', channelPeerId || null);
  const dialog = useStoreEntities('dialog', channelPeerId || null);
  const messageIdStr =
    personalChannelMessageId && personalChannelMessageId > 0
      ? String(personalChannelMessageId)
      : dialog?.topMessageId || null;

  const postMessage = useMessage(channelPeerId || null, messageIdStr);

  useEffect(() => {
    if (!channelPeerId) return;
    if (!channel) {
      void sdk.channel.getChannelsByIds([channelPeerId]).catch(() => undefined);
    }
  }, [channel, channelPeerId, sdk.channel]);

  useEffect(() => {
    if (!channelPeerId || !messageIdStr || postMessage) return;
    void sdk.messageLoad.getMessagesByIds(channelPeerId, [messageIdStr]).catch(() => undefined);
  }, [channelPeerId, messageIdStr, postMessage, sdk.messageLoad]);

  if (!channelPeerId) return null;

  const display = channel ? peerProfileDisplay(channel) : fallbackPeerDisplay(channelPeerId);
  const subscribers = channel?.participantsCount;
  const subscribersLabel =
    subscribers != null
      ? `${formatCompactNumber(subscribers)} ${subscribers === 1 ? 'SUBSCRIBER' : 'SUBSCRIBERS'}`
      : undefined;

  const preview = postMessage ? collectAlbumPreview([postMessage], postMessage) : undefined;
  const postDateLabel = postMessage?.date ? formatPastTimeShort(postMessage.date) : undefined;

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Channel</span>
        {subscribersLabel ? <span>{subscribersLabel}</span> : null}
      </div>

      <button
        type="button"
        onClick={() => {
          sdk.user.closeProfile();
          void selectDialog(channelPeerId);
        }}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PeerAvatar
          peerId={channelPeerId}
          display={display}
          photo={channel?.photo}
          className="size-11 shrink-0 text-sm"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <PeerTitle display={display} className="min-w-0 flex-1" />
            {postDateLabel ? (
              <span className="shrink-0 text-xs text-muted-foreground">{postDateLabel}</span>
            ) : null}
          </div>

          {postMessage ? (
            <MessageSummary
              lastMessage={postMessage}
              preview={preview}
              className="text-xs text-muted-foreground"
            />
          ) : channel?.username ? (
            <span className="truncate text-xs text-muted-foreground">@{channel.username}</span>
          ) : (
            <span className="truncate text-xs text-muted-foreground">View channel</span>
          )}
        </div>
      </button>
    </section>
  );
});

export default UserProfileChannelCard;
