'use client';

import DeleteMessageDialog from '@/components/main/middle-column/delete-message.dialog';
import ForwardRecipientDialog from '@/components/main/middle-column/forward-recipient.dialog';
import PinMessageDialog from '@/components/main/middle-column/pin-message.dialog';
import ReactorListDialog from '@/components/main/middle-column/reactor-list.dialog';
import MessageReactionReactorsList from '@/lib/components/message.reaction-reactors.list';
import PeerAvatar from '@/lib/components/peer.avatar';
import {
  ContextMenu,
  ContextMenuPrimitive,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/lib/components/ui/context-menu';
import {
  useDialogPeer,
  useGlobalStoreDialog,
  useSDK,
  useStore,
} from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import { actionChat } from '@/lib/utils/message-action-chat';
import { reactionKey, reactionsEqual } from '@telegenie/libs/foundation/telegram/helpers';
import type { TypeMessagePeerReaction } from '@telegenie/libs/foundation/telegram/types/api-types';
import {
  fallbackPeerDisplay,
  messageCopyText,
  messageMenuActions,
  peerProfileDisplay,
  type Message,
} from '@telegenie/sdk';
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Copy,
  Forward,
  Pencil,
  Pin,
  PinOff,
  Reply,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { observer } from 'mobx-react-lite';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

const VISIBLE_LIMIT = 7;
/** Matches `w-56` reactor panel width for viewport collision checks. */
const REACTOR_PANEL_WIDTH_PX = 224;
const VIEWPORT_EDGE_MARGIN_PX = 8;
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_PX = 8;
const COMPOSER_INPUT_SELECTOR = 'textarea[aria-label="Message"]';

function composerInput(): HTMLTextAreaElement | null {
  return document.querySelector<HTMLTextAreaElement>(COMPOSER_INPUT_SELECTOR);
}

/** Telegram stores ❤ as text; color emoji presentation needs the variation selector. */
function canonicalEmoticon(value: string): string {
  return value.replace(/\uFE0F/g, '');
}

function displayEmoticon(value: string): string {
  const base = canonicalEmoticon(value);
  if (base === '\u2764' || base === '\u2665') return '\u2764\uFE0F';
  return base;
}

type TypePeer = NonNullable<TypeMessagePeerReaction['peerId']>;

const menuItemClass = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent';

function peerIdFromTypePeer(peer?: TypePeer | null): string | undefined {
  if (!peer) return undefined;
  if ('userId' in peer && peer.userId) return String(peer.userId);
  if ('chatId' in peer && peer.chatId) return String(peer.chatId);
  if ('channelId' in peer && peer.channelId) return String(peer.channelId);
  return undefined;
}

function recentPeerIds(recent?: TypeMessagePeerReaction[]): string[] {
  const ids: string[] = [];
  for (const item of recent ?? []) {
    const peerId = peerIdFromTypePeer(item.peerId);
    if (!peerId || ids.includes(peerId)) continue;
    ids.push(peerId);
    if (ids.length === 3) break;
  }
  return ids;
}

/** Props for {@link MessageContextMenu}. */
export interface MessageContextMenuProps {
  peerId: string;
  message: Message;
  /** When false, renders `children` only (no context menu). */
  enabled: boolean;
  className?: string;
  /** Selecting messages: the menu does not open and long press does not react. */
  selectMode?: boolean;
  /** Every message id of an album row. The Select item toggles them together. */
  albumMessageIds?: string[];
  onMouseDown?: (event: MouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
}

/**
 * Right-click menu shell for one message row. Used in `message.item.tsx` for a
 * normal message, or a service message that can take reactions.
 *
 * Reactions, reply, edit, copy, pin, forward, and delete. Policy-aware emoji row
 * (`sdk.messageReaction`), toggle send, and optional “N Reacted” side panel.
 * Reads MobX `Message` reactions; writes via SDK; live updates from Telegram patches /
 * `message.list.tsx` refresh in groups and channels.
 */
const MessageContextMenuEnabled = observer(function MessageContextMenuEnabled({
  peerId,
  message,
  className,
  selectMode = false,
  albumMessageIds,
  onMouseDown,
  children,
}: Omit<MessageContextMenuProps, 'enabled'>) {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const peer = useDialogPeer(peerId);
  const dialogUI = useGlobalStoreDialog(peerId);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [menuEmojis, setMenuEmojis] = useState<string[] | null>(null);
  const [showReactors, setShowReactors] = useState(false);
  const [reactorDialogOpen, setReactorDialogOpen] = useState(false);
  const [reactorItems, setReactorItems] = useState<TypeMessagePeerReaction[]>([]);
  const [reactorsLoading, setReactorsLoading] = useState(false);
  const [panelAttachSide, setPanelAttachSide] = useState<'left' | 'right'>('right');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const menuMainRef = useRef<HTMLDivElement>(null);
  const focusComposerOnCloseRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef({ x: 0, y: 0 });
  const longPressFiredRef = useRef(false);

  const loadReactors = useCallback(async () => {
    setReactorsLoading(true);
    try {
      const result = await sdk.messageReaction.getMessageReactionsList({
        peerId,
        messageId: message.id,
        limit: 100,
      });
      setReactorItems(result.reactions);
    } catch {
      setReactorItems(message.reactions?.recentReactions ?? []);
    } finally {
      setReactorsLoading(false);
    }
  }, [sdk, peerId, message.id, message.reactions?.recentReactions]);

  useLayoutEffect(() => {
    if (!showReactors || !menuMainRef.current) return;
    const rect = menuMainRef.current.getBoundingClientRect();
    const fitsRight =
      rect.right + REACTOR_PANEL_WIDTH_PX <= window.innerWidth - VIEWPORT_EDGE_MARGIN_PX;
    const fitsLeft = rect.left - REACTOR_PANEL_WIDTH_PX >= VIEWPORT_EDGE_MARGIN_PX;
    if (fitsRight) setPanelAttachSide('right');
    else if (fitsLeft) setPanelAttachSide('left');
    else setPanelAttachSide('right');
  }, [showReactors, reactorsLoading, reactorItems.length]);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onQuickReactionLongPress = useCallback(async () => {
    longPressFiredRef.current = true;
    const emoji = await sdk.messageReaction.getDefaultReaction();
    void sdk.messageReaction.toggleReaction({
      peerId,
      messageId: message.id,
      reaction: { emoticon: canonicalEmoticon(emoji) },
      addToRecent: true,
    });
  }, [message.id, peerId, sdk.messageReaction]);

  const onTriggerPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      onMouseDown?.(event as unknown as MouseEvent<HTMLDivElement>);
      clearLongPress();
      longPressFiredRef.current = false;
      if (selectMode) return;
      longPressStartRef.current = { x: event.clientX, y: event.clientY };
      longPressTimerRef.current = setTimeout(() => {
        void onQuickReactionLongPress();
      }, LONG_PRESS_MS);
    },
    [clearLongPress, onMouseDown, onQuickReactionLongPress, selectMode],
  );

  const onTriggerPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const dx = event.clientX - longPressStartRef.current.x;
      const dy = event.clientY - longPressStartRef.current.y;
      if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_PX) clearLongPress();
    },
    [clearLongPress],
  );

  const onTriggerPointerUp = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  useEffect(() => () => clearLongPress(), [clearLongPress]);

  const choices = menuEmojis ?? [];
  const visible = expanded ? choices : choices.slice(0, VISIBLE_LIMIT);
  const hiddenCount = expanded ? 0 : Math.max(0, choices.length - VISIBLE_LIMIT);
  const menuReady = menuEmojis !== null;
  const reactionResults = message.reactions?.results ?? [];
  const isMenuEmojiChosen = (emoji: string) =>
    reactionResults.some(
      (row) =>
        row.chosenOrder != null &&
        reactionsEqual(row.reaction, { emoticon: canonicalEmoticon(emoji) }),
    );
  const results = reactionResults.filter((row) => row.count > 0);
  const reactedCount = results.reduce((sum, row) => sum + row.count, 0);
  const canSeeList = message.reactions?.canSeeList === true;
  const canOpenReactorList =
    reactedCount > 0 && (canSeeList || (message.reactions?.recentReactions?.length ?? 0) > 0);
  const currentUserId = globalStore.auth.currentUser?.id;
  const actions = messageMenuActions({
    message,
    chat: actionChat(peer),
    currentUserId,
    pinnedMessageIds: dialogUI?.pinnedMessageIds,
  });

  const canSelect = message.kind === 'message' && Number(message.id) > 0;

  const handleOpenChange = (next: boolean) => {
    if (next && selectMode) return;
    setOpen(next);
    if (!next) {
      setExpanded(false);
      setMenuEmojis(null);
      setShowReactors(false);
      setReactorItems([]);
      setReactorsLoading(false);
      setPanelAttachSide('right');
      return;
    }
    if (message.ttlPeriod) return;
    setMenuEmojis(null);
    void sdk.messageReaction.getReactionMenuEmojis(peerId, message.id).then((emojis) => {
      setMenuEmojis(emojis);
    });
  };

  const toggleEmoji = (emoji: string) => {
    void sdk.messageReaction.toggleReaction({
      peerId,
      messageId: message.id,
      reaction: { emoticon: canonicalEmoticon(emoji) },
      addToRecent: true,
    });
    setExpanded(false);
    setOpen(false);
  };

  const toggleReactorList = () => {
    if (!canOpenReactorList) return;
    if (canSeeList) {
      setReactorDialogOpen(true);
      setOpen(false);
      return;
    }
    if (showReactors) {
      setShowReactors(false);
      return;
    }
    setShowReactors(true);
    void loadReactors();
  };

  return (
    <>
      <ContextMenu open={open} onOpenChange={handleOpenChange}>
        <ContextMenuTrigger
          className={cn('min-w-0 max-w-full', className)}
          onPointerDown={onTriggerPointerDown}
          onPointerMove={onTriggerPointerMove}
          onPointerUp={onTriggerPointerUp}
          onPointerCancel={onTriggerPointerUp}
          onPointerLeave={onTriggerPointerUp}
          onContextMenuCapture={(event) => {
            if (longPressFiredRef.current) {
              event.preventDefault();
              longPressFiredRef.current = false;
              return;
            }
            event.preventDefault();
          }}
        >
          {children}
        </ContextMenuTrigger>
        <ContextMenuPrimitive.Portal>
          <ContextMenuPrimitive.Positioner className="z-50" data-slot="context-menu-positioner">
            <ContextMenuPrimitive.Popup
              className="flex w-max min-h-10 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg outline-none"
              data-slot="context-menu-popup"
              finalFocus={() => {
                if (!focusComposerOnCloseRef.current) return true;
                focusComposerOnCloseRef.current = false;
                return composerInput() ?? true;
              }}
              render={(props) => {
                const { style, ...domProps } = props;
                return (
                  <motion.div
                    {...(domProps as unknown as ComponentProps<typeof motion.div>)}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={open ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      ...style,
                      minHeight: '2.5rem',
                      width: 'max-content',
                      transformOrigin: 'var(--transform-origin)',
                    }}
                  />
                );
              }}
            >
              {showReactors && panelAttachSide === 'left' ? (
                <MessageReactionReactorsList
                  reactions={reactorItems}
                  loading={reactorsLoading}
                  attachSide="left"
                />
              ) : null}
              <div ref={menuMainRef} className="min-w-56 shrink-0 p-1" data-context-menu-main>
                {message.ttlPeriod ? null : (
                <div className="flex min-h-9 items-center gap-0.5 px-1">
                  {!menuReady ? (
                    <span className="px-2 py-1.5 text-xs text-muted-foreground">Loading…</span>
                  ) : (
                    visible.map((emoji) => (
                      <button
                        key={reactionKey({ emoticon: emoji })}
                        type="button"
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-xl leading-none outline-none hover:border-transparent focus:outline-none focus-visible:outline-none',
                          isMenuEmojiChosen(emoji)
                            ? 'bg-[#3390ec]/15 ring-2 ring-[#3390ec] ring-offset-1 ring-offset-popover'
                            : 'hover:bg-accent',
                        )}
                        aria-pressed={isMenuEmojiChosen(emoji)}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={() => toggleEmoji(emoji)}
                      >
                        {displayEmoticon(emoji)}
                      </button>
                    ))
                  )}
                  {menuReady && hiddenCount > 0 ? (
                    <button
                      type="button"
                      aria-label="More reactions"
                      className="ms-auto flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground hover:border-transparent hover:bg-accent"
                      onClick={() => setExpanded(true)}
                    >
                      <ChevronDown className="size-4" />
                    </button>
                  ) : null}
                </div>
                )}
                {message.kind === 'message' ? (
                  <>
                    {message.ttlPeriod ? null : <ContextMenuSeparator />}
                    <button
                      type="button"
                      className={menuItemClass}
                      onClick={() => {
                        focusComposerOnCloseRef.current = true;
                        sdk.messageDraft.setReplyingTo(peerId, message.id);
                        composerInput()?.focus();
                        setOpen(false);
                      }}
                    >
                      <Reply className="size-4 shrink-0 text-muted-foreground" />
                      Reply
                    </button>
                    {actions.canEdit ? (
                      <button
                        type="button"
                        className={menuItemClass}
                        onClick={() => {
                          focusComposerOnCloseRef.current = true;
                          sdk.messageDraft.startEditing(peerId, message.id);
                          composerInput()?.focus();
                          setOpen(false);
                        }}
                      >
                        <Pencil className="size-4 shrink-0 text-muted-foreground" />
                        Edit
                      </button>
                    ) : null}
                    {actions.canCopy ? (
                      <button
                        type="button"
                        className={menuItemClass}
                        onClick={() => {
                          void navigator.clipboard.writeText(messageCopyText(message)).catch(() => undefined);
                          setOpen(false);
                        }}
                      >
                        <Copy className="size-4 shrink-0 text-muted-foreground" />
                        Copy
                      </button>
                    ) : null}
                    {actions.canPin ? (
                      <button
                        type="button"
                        className={menuItemClass}
                        onClick={() => {
                          setPinOpen(true);
                          setOpen(false);
                        }}
                      >
                        <Pin className="size-4 shrink-0 text-muted-foreground" />
                        Pin
                      </button>
                    ) : null}
                    {actions.canUnpin ? (
                      <button
                        type="button"
                        className={menuItemClass}
                        onClick={() => {
                          const id = Number(message.id);
                          if (Number.isInteger(id) && id > 0) {
                            void sdk.messageSend.updatePinnedMessage(peerId, id, { unpin: true });
                          }
                          setOpen(false);
                        }}
                      >
                        <PinOff className="size-4 shrink-0 text-muted-foreground" />
                        Unpin
                      </button>
                    ) : null}
                    {actions.canForward ? (
                      <button
                        type="button"
                        className={menuItemClass}
                        onClick={() => {
                          setForwardOpen(true);
                          setOpen(false);
                        }}
                      >
                        <Forward className="size-4 shrink-0 text-muted-foreground" />
                        Forward
                      </button>
                    ) : null}
                    {canSelect ? (
                      <button
                        type="button"
                        className={menuItemClass}
                        onClick={() => {
                          sdk.messageSelect.toggle(
                            peerId,
                            { messageId: message.id, childMessageIds: albumMessageIds },
                            dialogUI?.activeThreadId,
                          );
                          setOpen(false);
                        }}
                      >
                        <CheckSquare className="size-4 shrink-0 text-muted-foreground" />
                        Select
                      </button>
                    ) : null}
                    {actions.canDelete ? (
                      <>
                        <ContextMenuSeparator />
                        <button
                          type="button"
                          className={`${menuItemClass} text-destructive`}
                          onClick={() => {
                            setDeleteOpen(true);
                            setOpen(false);
                          }}
                        >
                          <Trash2 className="size-4 shrink-0" />
                          Delete
                        </button>
                      </>
                    ) : null}
                  </>
                ) : null}
                {reactedCount > 0 ? (
                  <>
                    <ContextMenuSeparator />
                    {canOpenReactorList ? (
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent',
                          showReactors && 'bg-accent/80',
                        )}
                        aria-expanded={showReactors}
                        onClick={toggleReactorList}
                      >
                        <span className="min-w-0 flex-1 text-left">
                          {canSeeList ? 'Who reacted' : `${reactedCount} Reacted`}
                        </span>
                        <RecentAvatars recent={message.reactions?.recentReactions} />
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                        <span className="min-w-0 flex-1">{reactedCount} Reacted</span>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
              {showReactors && panelAttachSide === 'right' ? (
                <MessageReactionReactorsList
                  reactions={reactorItems}
                  loading={reactorsLoading}
                  attachSide="right"
                />
              ) : null}
            </ContextMenuPrimitive.Popup>
          </ContextMenuPrimitive.Positioner>
        </ContextMenuPrimitive.Portal>
      </ContextMenu>
      {canSeeList ? (
        <ReactorListDialog
          open={reactorDialogOpen}
          onOpenChange={setReactorDialogOpen}
          peerId={peerId}
          messageId={message.id}
          results={results}
          totalCount={reactedCount}
        />
      ) : null}
      <DeleteMessageDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        peerId={peerId}
        messageIds={[message.id]}
        allowForAll={actions.canDeleteForAll}
      />
      <PinMessageDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        peerId={peerId}
        messageId={message.id}
        notifyChoice={actions.canNotifyPin}
      />
      <ForwardRecipientDialog
        open={forwardOpen}
        onOpenChange={setForwardOpen}
        fromPeerId={peerId}
        messageId={message.id}
      />
    </>
  );
});

function MessageContextMenu({
  enabled,
  className,
  onMouseDown,
  children,
  ...menuProps
}: MessageContextMenuProps) {
  if (!enabled) {
    return (
      <div className={cn('min-w-0 max-w-full', className)} onMouseDown={onMouseDown}>
        {children}
      </div>
    );
  }
  return (
    <MessageContextMenuEnabled className={className} onMouseDown={onMouseDown} {...menuProps}>
      {children}
    </MessageContextMenuEnabled>
  );
}

const RecentAvatars = observer(function RecentAvatars({
  recent,
}: {
  recent?: TypeMessagePeerReaction[];
}) {
  const peerIds = recentPeerIds(recent);
  if (peerIds.length === 0) return null;
  return (
    <span className="flex -space-x-1.5">
      {peerIds.map((id) => (
        <RecentAvatar key={id} peerId={id} />
      ))}
    </span>
  );
});

const RecentAvatar = observer(function RecentAvatar({ peerId }: { peerId: string }) {
  const peer = useDialogPeer(peerId);
  const display = peer ? peerProfileDisplay(peer) : fallbackPeerDisplay(peerId);
  return (
    <PeerAvatar
      peerId={peerId}
      display={display}
      photo={peer?.photo}
      className="size-5 text-[9px] ring-2 ring-popover"
    />
  );
});

export default MessageContextMenu;
