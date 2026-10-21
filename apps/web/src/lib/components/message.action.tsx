'use client';

import { useDialogPeer, useMessage, useSDK, useStoreEntities } from '@/lib/contexts/sdk.context';
import { useCopyMessageId } from '@/lib/hooks/use-copy-message-id';
import { useFocusMessage } from '@/lib/hooks/use-focus-message';
import type { ObserveFn } from '@/lib/hooks/use-intersection-observer';
import { cn } from '@/lib/utils';
import type { Channel, Chat, Message, User } from '@telegenie/sdk';
import { peerActionName } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useRef } from 'react';

interface MessageActionProps {
  message: Message;
  className?: string;
  observeIntersectionForRead?: ObserveFn;
  isFocused?: boolean;
}

type DialogPeer = User | Channel | Chat;

function formatUserList(userIds: string[], users: Array<User | null>): string {
  const names = userIds.map((_id, index) => peerActionName(users[index] ?? undefined) ?? 'Someone');

  if (names.length === 0) return 'Someone';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function truncateSnippet(text: string, maxLength = 36): string {
  const singleLine = text.replace(/[\r\n\t]+/g, ' ').trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 1)}…`;
}

export function buildPinnedSnippet(
  pinnedMessage: Message | null | undefined,
  quoteText?: string | null,
): string | undefined {
  const trimmedQuote = quoteText?.trim();
  if (trimmedQuote) {
    return truncateSnippet(trimmedQuote);
  }

  if (!pinnedMessage || pinnedMessage.isEmpty) {
    return undefined;
  }

  const text = pinnedMessage.message?.trim();

  if (pinnedMessage.media) {
    if (
      pinnedMessage.isDocument ||
      ('document' in pinnedMessage.media && !pinnedMessage.isPhoto && !pinnedMessage.isVideo)
    ) {
      const label = text || pinnedMessage.mediaFileName || 'File';
      return `📎 ${truncateSnippet(label)}`;
    }
    if (pinnedMessage.isPhoto || 'photo' in pinnedMessage.media) {
      const label = text || 'Photo';
      return `📷 ${truncateSnippet(label)}`;
    }
    if (pinnedMessage.isVideo) {
      const label = text || (pinnedMessage.isRoundVideo ? 'Video message' : 'Video');
      return `📹 ${truncateSnippet(label)}`;
    }
    if ('voice' in pinnedMessage.media && Boolean((pinnedMessage.media as { voice?: boolean }).voice)) {
      return '🎤 Voice message';
    }
    if ('poll' in pinnedMessage.media) {
      const poll = (pinnedMessage.media as { poll?: { question?: { text?: string } | string } }).poll;
      const question = typeof poll?.question === 'object' ? poll.question?.text : poll?.question;
      return `📊 ${truncateSnippet(question || 'Poll')}`;
    }
    if ('geo' in pinnedMessage.media || 'venueId' in pinnedMessage.media) {
      return '📍 Location';
    }
    if ('phoneNumber' in pinnedMessage.media) {
      return '👤 Contact';
    }
    if (pinnedMessage.mediaFileName) {
      return `📎 ${truncateSnippet(text || pinnedMessage.mediaFileName)}`;
    }
    if (text) {
      return truncateSnippet(text);
    }
    const label = pinnedMessage.summaryText;
    if (label && label !== 'Service message') {
      return truncateSnippet(label);
    }
  }

  if (text) {
    return truncateSnippet(text);
  }

  return undefined;
}

function buildActionText(
  message: Message,
  peers: {
    fromPeer: DialogPeer | null;
    dialogPeer?: DialogPeer | null;
    joinedPeer: DialogPeer | null;
    leftPeer: DialogPeer | null;
    addedUsers: Array<User | null>;
  },
  pinnedMessage?: Message | null,
): string {
  const action = message.action;

  const isPin =
    message.isPinMessage ||
    Boolean(action && ('isPin' in action || ('type' in action && action.type === 'pinMessage'))) ||
    (message.kind === 'service' && message.replyToMessageId != null);

  if (isPin) {
    const senderName = message.out
      ? 'You'
      : message.fromId
        ? (peerActionName(peers.fromPeer) ?? 'Someone')
        : undefined;

    const snippet = buildPinnedSnippet(pinnedMessage, message.messageReplyHeader?.quoteText);

    if (senderName) {
      if (snippet) {
        return `${senderName} pinned "${snippet}"`;
      }
      return `${senderName} pinned a message`;
    }

    if (snippet) {
      return `Pinned "${snippet}"`;
    }
    return 'Pinned a message';
  }

  const isBoost =
    message.isBoostMessage ||
    Boolean(
      action &&
        ('boosts' in action ||
          ('type' in action && (action as { type?: string }).type === 'boostApply')),
    );

  if (isBoost) {
    const rawBoosts =
      action && typeof action === 'object' && 'boosts' in action
        ? (action as { boosts?: number }).boosts
        : message.boostCount;
    const count = typeof rawBoosts === 'number' && rawBoosts > 0 ? rawBoosts : 1;

    const isChannel =
      peers.dialogPeer &&
      'broadcast' in peers.dialogPeer &&
      Boolean(peers.dialogPeer.broadcast);
    const targetType = isChannel ? 'channel' : 'group';

    const senderName = message.out
      ? 'You'
      : message.fromId
        ? (peerActionName(peers.fromPeer) ?? 'Someone')
        : undefined;

    const timesSuffix = count > 1 ? ` ${count} times` : '';

    if (senderName) {
      return `${senderName} boosted the ${targetType}${timesSuffix}`;
    }
    return `Boosted the ${targetType}${timesSuffix}`;
  }

  if (!action) {
    return message.summaryText || 'Service message';
  }

  if ('title' in action && typeof action.title === 'string') {
    if ('users' in action) {
      return `Group "${action.title}" created`;
    }
    return `Group title changed to "${action.title}"`;
  }
  if ('photo' in action) {
    return 'Chat photo updated';
  }
  if ('photoDeleted' in action) {
    return 'Chat photo removed';
  }
  if ('users' in action && Array.isArray(action.users)) {
    return `${formatUserList(action.users, peers.addedUsers)} joined the group`;
  }
  if ('inviterId' in action) {
    if (message.out) {
      return 'You joined the group via invite link';
    }
    const name = peerActionName(peers.joinedPeer) ?? 'Someone';
    return `${name} joined the group via invite link`;
  }
  if ('userId' in action && typeof action.userId === 'string') {
    if (message.out) {
      return 'You left the group';
    }
    const name = peerActionName(peers.leftPeer) ?? 'Someone';
    return `${name} left the group`;
  }
  if ('callId' in action) {
    return 'Phone call';
  }
  if ('screenshotTaken' in action) {
    const name = message.out ? 'You' : peerActionName(peers.fromPeer) ?? 'Someone';
    return `${name} took a screenshot`;
  }
  if ('contactSignUp' in action) {
    const name = message.out ? 'You' : peerActionName(peers.fromPeer) ?? 'Someone';
    return `${name} joined Telegram`;
  }
  if ('historyCleared' in action) {
    return 'History cleared';
  }
  if ('message' in action && typeof action.message === 'string') {
    return action.message;
  }

  return message.summaryText || 'Service message';
}

const MessageAction = observer(function MessageAction({
  message,
  className,
  observeIntersectionForRead,
  isFocused = false,
}: MessageActionProps) {
  const bottomMarkerRef = useRef<HTMLDivElement>(null);
  const copyMessageId = useCopyMessageId(message.id);
  const focusMessage = useFocusMessage();
  const sdk = useSDK();
  const action = message.action;

  const joinedFromId =
    action && 'inviterId' in action ? message.fromId : undefined;
  const leftUserId =
    action && 'userId' in action && typeof action.userId === 'string'
      ? action.userId
      : undefined;
  const addedUserIds =
    action && 'users' in action && Array.isArray(action.users) ? action.users : [];

  const fromPeer = useDialogPeer(message.fromId);
  const dialogPeer = useDialogPeer(message.peerId);
  const joinedPeer = useDialogPeer(joinedFromId);
  const leftPeer = useDialogPeer(leftUserId);
  const addedUsers = useStoreEntities('user', addedUserIds) as Array<User | null>;

  const replyToMsgId = message.replyToMessageId;
  const targetPeerId = message.replyTargetPeerId;
  const pinnedMessage = useMessage(
    replyToMsgId != null ? targetPeerId : null,
    replyToMsgId != null ? String(replyToMsgId) : null,
  );

  const isPin =
    message.isPinMessage ||
    Boolean(action && ('isPin' in action || ('type' in action && action.type === 'pinMessage'))) ||
    (message.kind === 'service' && replyToMsgId != null);

  useEffect(() => {
    if (isPin && replyToMsgId != null && !pinnedMessage) {
      void sdk.messageLoad.getMessagesByIds(targetPeerId, [String(replyToMsgId)]);
    }
  }, [isPin, pinnedMessage, replyToMsgId, sdk.messageLoad, targetPeerId]);

  const actionText = useMemo(
    () =>
      buildActionText(
        message,
        { fromPeer, dialogPeer, joinedPeer, leftPeer, addedUsers },
        pinnedMessage,
      ),
    [addedUsers, dialogPeer, fromPeer, joinedPeer, leftPeer, message, pinnedMessage],
  );

  useEffect(() => {
    const element = bottomMarkerRef.current;
    if (!element || !observeIntersectionForRead) return undefined;
    return observeIntersectionForRead(element);
  }, [message.id, observeIntersectionForRead]);

  const isClickable = isPin && replyToMsgId != null;

  const handleClick = (event: React.MouseEvent) => {
    if (isClickable) {
      event.stopPropagation();
      focusMessage({
        peerId: targetPeerId,
        messageId: String(replyToMsgId),
      });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isClickable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopPropagation();
      focusMessage({
        peerId: targetPeerId,
        messageId: String(replyToMsgId),
      });
    }
  };

  return (
    <div
      className={cn(
        'relative flex w-full justify-center py-2 select-none transition-colors duration-500 ease-out',
        isFocused
          ? '-mx-1 w-[calc(100%+0.5rem)] bg-primary/10 py-2 dark:bg-primary/15'
          : 'bg-transparent',
        className,
      )}
      onMouseDown={copyMessageId}
    >
      <div
        ref={bottomMarkerRef}
        className="pointer-events-none absolute bottom-0 left-0 h-px w-full"
        data-message-id={message.id}
        aria-hidden
      />
      <span
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={isClickable ? handleClick : undefined}
        onKeyDown={isClickable ? handleKeyDown : undefined}
        className={cn(
          'max-w-[90%] px-4 text-center text-xs font-medium text-muted-foreground outline-none',
          isClickable && 'cursor-pointer hover:text-foreground active:opacity-70 transition-colors',
        )}
      >
        {actionText}
      </span>
    </div>
  );
});

export default MessageAction;
