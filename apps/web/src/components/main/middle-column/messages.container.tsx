'use client';
import {
  Channel,
  Chat,
  Dialog,
  fallbackPeerDisplay,
  MAIN_THREAD_ID,
  SERVICE_NOTIFICATIONS_USER_ID,
  User,
} from '@telegenie/sdk';
import { Bot, CheckSquare, EllipsisVertical, PanelRightOpen } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';

import MessageComposer from '@/components/main/middle-column/message-composer/message.composer';
import MessageSelectToolbar from '@/components/main/middle-column/message-select.toolbar';
import MessageList from '@/components/main/middle-column/message.list';
import PinnedMessageBar from '@/components/main/middle-column/pinned-message.bar';
import PinnedMessageList from '@/components/main/middle-column/pinned-message.list';
import PeerAvatar from '@/lib/components/peer.avatar';
import { Button } from '@/lib/components/ui/button';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '@/lib/components/ui/menu';
import {
  useDialogPeer,
  useGlobalStoreDialog,
  useGlobalStoreThread,
  useSDK,
  useStore,
  useStoreEntities,
} from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import { formatUserStatus } from '@/lib/utils/date';
import { formatCompactNumber } from '@/lib/utils/format';
import { AnimatePresence, motion } from 'motion/react';

interface MessagesContainerProps {
  onToggleConfig: () => void;
  onOpenGenie?: () => void;
}

const MessagesContainer = observer(({ onToggleConfig, onOpenGenie }: MessagesContainerProps) => {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const selectedDialogId = globalStore.nav.selectedDialogId;
  const dialog = useStoreEntities('dialog', selectedDialogId);
  const peer = useDialogPeer(dialog?.peerId ?? selectedDialogId);
  const peerId = dialog?.peerId ?? selectedDialogId;
  const display = peerId ? (peer?.display ?? fallbackPeerDisplay(peerId)) : undefined;

  const dialogUI = useGlobalStoreDialog(selectedDialogId);
  const isPinnedViewOpen = Boolean(dialogUI?.isPinnedViewOpen);
  const activeThreadId = dialogUI?.activeThreadId ?? MAIN_THREAD_ID;
  const threadUI = useGlobalStoreThread(selectedDialogId, activeThreadId);
  const isSelectMode = Boolean(threadUI?.isSelectMode) && !isPinnedViewOpen;
  const canEnterSelectMode =
    !isPinnedViewOpen && !isSelectMode && (threadUI?.listedIds.length ?? 0) > 0;

  const peerKind = dialog?.peerKind ?? (peerId ? Dialog.peerKindFromId(peerId) : undefined);
  const channel = peerKind === 'channel' ? (peer as Channel | null) : null;
  const channelFull = useStoreEntities('channelFull', peerKind === 'channel' ? peerId : null);
  const chat = peerKind === 'chat' ? (peer as Chat | null) : null;
  const chatFull = useStoreEntities('chatFull', peerKind === 'chat' ? peerId : null);
  const user = peerKind === 'user' ? (peer as User | null) : null;
  const userFull = useStoreEntities('userFull', peerKind === 'user' ? peerId : null);

  const fullPinnedMsgId =
    channelFull?.pinnedMsgId ?? chatFull?.pinnedMsgId ?? userFull?.pinnedMsgId;
  const hasPinnedMessages =
    (dialogUI?.pinnedMessageIds.length ?? 0) > 0 ||
    (dialogUI?.pinnedMessagesCount ?? 0) > 0 ||
    Boolean(fullPinnedMsgId && fullPinnedMsgId > 0);

  useEffect(() => {
    if (selectedDialogId) {
      sdk.messageLoad.loadPinnedMessages(selectedDialogId);
    }
  }, [selectedDialogId, sdk]);

  let subtitle: string | undefined;

  if (peerKind === 'channel') {
    const isBroadcast = channel ? channel.broadcast : true;
    if (isBroadcast) {
      const subscribers = channelFull?.participantsCount ?? channel?.participantsCount;
      if (subscribers != null) {
        subtitle = `${formatCompactNumber(subscribers)} ${subscribers === 1 ? 'subscriber' : 'subscribers'}`;
      } else {
        subtitle = 'channel';
      }
    } else {
      // Megagroup / Supergroup
      const members = channelFull?.participantsCount ?? channel?.participantsCount;
      const online = channelFull?.onlineCount;
      if (members != null) {
        subtitle = `${formatCompactNumber(members)} ${members === 1 ? 'member' : 'members'}${
          online && online > 0 ? `, ${formatCompactNumber(online)} online` : ''
        }`;
      } else {
        subtitle = 'group';
      }
    }
  } else if (peerKind === 'chat') {
    const participantsList =
      chatFull?.participants && 'participants' in chatFull.participants
        ? chatFull.participants.participants
        : undefined;
    const members = chat?.participantsCount ?? participantsList?.length;
    if (members != null) {
      subtitle = `${formatCompactNumber(members)} ${members === 1 ? 'member' : 'members'}`;
    } else {
      subtitle = 'group';
    }
  } else if (peerKind === 'user') {
    if (peerId === SERVICE_NOTIFICATIONS_USER_ID || user?.id === SERVICE_NOTIFICATIONS_USER_ID) {
      subtitle = 'service notifications';
    } else if (user?.deleted || display?.isDeleted) {
      subtitle = undefined;
    } else if (user?.bot) {
      subtitle = 'bot';
    } else if (display?.isSavedMessages || user?.self) {
      subtitle = undefined;
    } else if (user?.support) {
      subtitle = 'support';
    } else if (user) {
      subtitle = formatUserStatus(user.status);
    }
  }

  const isOnline = subtitle === 'online';

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4 gap-3">
        {display && peerId && (
          <PeerAvatar
            peerId={peerId}
            display={display}
            photo={peer?.photo}
            className="size-9 text-xs"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="flex min-w-0 items-baseline gap-1.5 text-sm font-semibold text-foreground leading-tight">
            <span className="truncate">{display?.name || 'Select a conversation'}</span>
            {process.env.NODE_ENV === 'development' && peerId ? (
              <span className="shrink-0 font-mono text-[11px] font-normal text-muted-foreground">
                {peerId}
              </span>
            ) : null}
          </span>
          {subtitle && (
            <span
              className={cn(
                'truncate text-xs leading-normal mt-0.5',
                isOnline ? 'text-primary font-medium' : 'text-muted-foreground',
              )}
            >
              {subtitle}
            </span>
          )}
        </div>

        {selectedDialogId ? (
          <Menu>
            <MenuTrigger
              aria-label="More actions"
              className="ml-2 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none transition-colors hover:bg-accent"
            >
              <EllipsisVertical className="size-4" />
            </MenuTrigger>
            <MenuPopup align="end" className="w-48">
              <MenuItem
                disabled={!canEnterSelectMode}
                onClick={() => sdk.messageSelect.enter(selectedDialogId, [], activeThreadId)}
              >
                <CheckSquare />
                <span>Select messages</span>
              </MenuItem>
            </MenuPopup>
          </Menu>
        ) : null}

        {onOpenGenie && (
          <Button
            id="open-genie-copilot"
            variant="ghost"
            size="sm"
            onClick={onOpenGenie}
            aria-label="Open Genie Copilot"
            className="flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg shrink-0"
          >
            <Bot className="size-4" />
            <span className="hidden sm:inline">Genie</span>
          </Button>
        )}

        <Button
          id="toggle-dialog-config"
          variant="ghost"
          size="icon"
          onClick={onToggleConfig}
          aria-label="Toggle dialog info panel"
          className="shrink-0"
        >
          <PanelRightOpen className="size-4" />
        </Button>
      </div>

      <div className="relative flex flex-1 flex-col min-h-0 overflow-hidden">
        {selectedDialogId ? (
          <>
            <AnimatePresence initial={false}>
              {hasPinnedMessages && (
                <motion.div
                  key="pinned-message-bar"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden shrink-0"
                >
                  <PinnedMessageBar peerId={selectedDialogId} />
                </motion.div>
              )}
            </AnimatePresence>

            <MessageList peerId={selectedDialogId} className="flex-1 min-h-0" />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <svg
                className="size-8 text-muted-foreground/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Select a conversation</p>
              <p className="text-xs text-muted-foreground">
                Choose a dialog from the left to start reading messages.
              </p>
            </div>
          </div>
        )}

        {/* Pinned Messages View (Slides in over the chat area) */}
        <AnimatePresence>
          {selectedDialogId && isPinnedViewOpen && (
            <motion.div
              key="pinned-message-view"
              initial={{ x: '100%', opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.8 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="absolute inset-0 z-30 flex flex-col bg-background"
            >
              <PinnedMessageList
                peerId={selectedDialogId}
                onBack={() => sdk.messageLoad.closePinnedView(selectedDialogId)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {selectedDialogId && !isPinnedViewOpen && (
        <>
          {isSelectMode ? <MessageSelectToolbar peerId={selectedDialogId} /> : null}
          {/* Stay mounted while selecting so the draft and editor state survive. */}
          <div className={isSelectMode ? 'hidden' : 'contents'}>
            <MessageComposer key={selectedDialogId} peerId={selectedDialogId} />
          </div>
        </>
      )}
    </div>
  );
});

export default MessagesContainer;
