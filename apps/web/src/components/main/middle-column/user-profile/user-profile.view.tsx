'use client';

import type { TypeBirthday } from '@telegenie/libs/foundation/telegram/types/api-types';
import {
  fallbackPeerDisplay,
  peerProfileDisplay,
  SERVICE_NOTIFICATIONS_USER_ID,
} from '@telegenie/sdk';
import {
  BadgeCheck,
  Ban,
  Bell,
  BellOff,
  ChevronLeft,
  Ellipsis,
  Lock,
  MessageCircle,
  Pencil,
  Phone,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import CopyButton from '@/lib/components/copy.button';
import PeerAvatar from '@/lib/components/peer.avatar';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from '@/lib/components/ui/menu';
import { ScrollArea } from '@/lib/components/ui/scroll-area';
import { useSDK, useStoreEntities } from '@/lib/contexts/sdk.context';
import { useDocumentEvent } from '@/lib/hooks/use-document-event';
import { useSelectDialog } from '@/lib/hooks/use-select-dialog';
import { cn } from '@/lib/utils';
import { formatUserStatus } from '@/lib/utils/date';
import { formatCompactNumber } from '@/lib/utils/format';
import BlockUserDialog from './block-user.dialog';
import UserContactDialog from './user-contact.dialog';
import UserProfileBioText from './user-profile-bio.text';
import UserProfileChannelCard from './user-profile-channel.card';

export interface UserProfileViewProps {
  peerId: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatPhoneDisplay(phone?: string): string | undefined {
  const trimmed = phone?.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

function formatBirthdayDisplay(birthday?: TypeBirthday, now = new Date()): string | undefined {
  if (!birthday || !birthday.day || !birthday.month) return undefined;
  const monthName = MONTH_NAMES[birthday.month - 1];
  if (!monthName) return undefined;
  if (!birthday.year) {
    return `${monthName} ${birthday.day}`;
  }
  let age = now.getFullYear() - birthday.year;
  const hasHadBirthdayThisYear =
    now.getMonth() + 1 > birthday.month ||
    (now.getMonth() + 1 === birthday.month && now.getDate() >= birthday.day);
  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }
  const ageSuffix = age > 0 ? ` (${age} years old)` : '';
  return `${monthName} ${birthday.day}, ${birthday.year}${ageSuffix}`;
}

function isNotifyMuted(muteUntil?: number): boolean {
  if (!muteUntil) return false;
  return muteUntil > Math.floor(Date.now() / 1000);
}

const UserProfileView = observer(function UserProfileView({ peerId }: UserProfileViewProps) {
  const sdk = useSDK();
  const selectDialog = useSelectDialog();

  const user = useStoreEntities('user', peerId);
  const userFull = useStoreEntities('userFull', peerId);
  const dialog = useStoreEntities('dialog', peerId);

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (!peerId) return;
    if (!user) {
      void sdk.user.getUsersByIds([peerId]).catch(() => undefined);
    }
    if (!userFull) {
      void sdk.user
        .getFullUsers([{ id: peerId, accessHash: user?.accessHash }])
        .catch(() => undefined);
    }
  }, [peerId, sdk.user, user, userFull]);

  useDocumentEvent(
    'keydown',
    useCallback(
      (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || contactDialogOpen || blockDialogOpen) return;
        if (document.querySelector('[data-slot="menu-popup"], [data-slot="dialog-popup"], [data-slot="alert-dialog-popup"]')) {
          return;
        }
        event.preventDefault();
        sdk.user.popProfile();
      },
      [blockDialogOpen, contactDialogOpen, sdk.user],
    ),
  );

  const display = user ? peerProfileDisplay(user) : fallbackPeerDisplay(peerId);
  const isServiceNotifications =
    peerId === SERVICE_NOTIFICATIONS_USER_ID || user?.id === SERVICE_NOTIFICATIONS_USER_ID;

  let subtitle: string | undefined;
  if (isServiceNotifications) {
    subtitle = 'service notifications';
  } else if (user?.deleted || display.isDeleted) {
    subtitle = undefined;
  } else if (user?.bot) {
    subtitle =
      user.botActiveUsers && user.botActiveUsers > 0
        ? `${formatCompactNumber(user.botActiveUsers)} monthly users`
        : 'bot';
  } else if (user?.support) {
    subtitle = 'support';
  } else if (user) {
    subtitle = formatUserStatus(user.status);
  }
  const isOnline = subtitle === 'online';

  const activeUsernames = (user?.usernames ?? [])
    .filter((entry) => entry.active && entry.username)
    .map((entry) => entry.username);
  const primaryUsername = user?.username || activeUsernames[0] || undefined;
  const extraUsernames = activeUsernames.filter(
    (uname) => uname.toLowerCase() !== primaryUsername?.toLowerCase(),
  );

  const formattedPhone = formatPhoneDisplay(user?.phone);
  const bioText = (userFull?.about || userFull?.botInfo?.description || '').trim();
  const birthdayText = formatBirthdayDisplay(userFull?.birthday);

  const currentUserId = sdk.globalStore?.auth?.currentUser?.id;
  const isSelf = Boolean(user?.self || (currentUserId && String(currentUserId) === peerId));
  const muteUntil = dialog?.notifySettings?.muteUntil ?? userFull?.notifySettings?.muteUntil;
  const isMuted = isNotifyMuted(muteUntil);
  const isBlocked = Boolean(userFull?.blocked);
  const isContact = Boolean(user?.contact);
  const canManageContact = !isSelf && !user?.bot && !isServiceNotifications && !user?.deleted;
  const canStartSecretChat = !isSelf && !user?.bot && !isServiceNotifications && !user?.deleted;
  const callsAvailable =
    !isSelf && Boolean(userFull?.phoneCallsAvailable) && !user?.bot && !isServiceNotifications;
  const canBlock = !isSelf && !isServiceNotifications;

  const handleOpenChat = useCallback(() => {
    sdk.user.closeProfile();
    void selectDialog(peerId);
  }, [peerId, sdk.user, selectDialog]);

  const handleCallClick = useCallback(() => {
    if (!callsAvailable) {
      toast.info('Voice calls are not available for this user');
      return;
    }
    toast.info('Voice calls coming soon');
  }, [callsAvailable]);

  const handleToggleMute = useCallback(async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const nextMuted = !isMuted;
      await sdk.user.setMuted(peerId, nextMuted);
      toast.success(nextMuted ? 'Notifications muted' : 'Notifications unmuted');
    } catch (err) {
      console.error('Failed to update mute state:', err);
      toast.error('Failed to update notifications');
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, isMuted, peerId, sdk.user]);

  const handleStartSecretChat = useCallback(async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await sdk.encryptedChat.create(peerId, user?.accessHash);
      toast.success(`Requested secret chat with ${display.name}`);
    } catch (err) {
      console.error('Failed to start secret chat:', err);
      toast.error('Failed to start secret chat');
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, display.name, peerId, sdk.encryptedChat, user?.accessHash]);

  const handleDeleteContact = useCallback(async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await sdk.user.deleteContact(peerId);
      toast.success('Removed from contacts');
    } catch (err) {
      console.error('Failed to delete contact:', err);
      toast.error('Failed to delete contact');
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, peerId, sdk.user]);

  const handleToggleBlock = useCallback(async () => {
    if (!isBlocked) {
      setBlockDialogOpen(true);
      return;
    }
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await sdk.user.setBlocked(peerId, false);
      toast.success(`Unblocked ${display.name}`);
    } catch (err) {
      console.error('Failed to unblock user:', err);
      toast.error('Failed to unblock user');
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, display.name, isBlocked, peerId, sdk.user]);

  const hasInfoCardRows = Boolean(
    formattedPhone ||
      primaryUsername ||
      bioText ||
      birthdayText ||
      (canManageContact && !isContact) ||
      canBlock,
  );

  const actionTileClass =
    'flex h-14 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-border/60 bg-card px-3 text-xs font-medium text-primary transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="flex h-full w-full flex-col bg-background" data-testid="user-profile-view">
      <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => sdk.user.popProfile()}
          className="-ml-2 gap-1 px-2 text-sm font-medium text-primary hover:bg-primary/10 hover:text-primary"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
          <span>Back</span>
        </Button>

        <h1 className="pointer-events-none absolute inset-x-24 truncate text-center text-sm font-semibold text-foreground">
          Info
        </h1>

        <div className="w-14 shrink-0" aria-hidden="true" />
      </header>

      <ScrollArea className="flex-1">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 py-6">
          {/* Hero: large avatar + name + status */}
          <div className="flex flex-col items-center gap-2.5 text-center">
            <PeerAvatar
              peerId={peerId}
              display={display}
              photo={user?.photo}
              isBig
              className="size-28 text-3xl shadow-xs"
            />

            <div className="flex max-w-full flex-col items-center gap-0.5">
              <div className="flex max-w-full items-center justify-center gap-1.5">
                <h2 className="truncate text-xl font-semibold leading-tight text-foreground">
                  {display.name}
                </h2>
                {display.isVerified ? (
                  <BadgeCheck className="size-4.5 shrink-0 text-primary" aria-label="Verified" />
                ) : null}
                {user?.scam ? <Badge variant="destructive">SCAM</Badge> : null}
                {user?.fake ? <Badge variant="destructive">FAKE</Badge> : null}
              </div>

              {subtitle ? (
                <p
                  className={cn(
                    'text-sm leading-snug',
                    isOnline ? 'font-medium text-primary' : 'text-muted-foreground',
                  )}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>

          {/* Action tiles: Message / Call / More */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <button type="button" onClick={handleOpenChat} className={actionTileClass}>
              <MessageCircle className="size-5 fill-current" aria-hidden="true" />
              <span>Message</span>
            </button>

            <button
              type="button"
              aria-disabled={!callsAvailable || undefined}
              onClick={handleCallClick}
              className={cn(actionTileClass, !callsAvailable && 'opacity-55')}
            >
              <Phone className="size-5 fill-current" aria-hidden="true" />
              <span>Call</span>
            </button>

            <Menu>
              <MenuTrigger className={actionTileClass}>
                <Ellipsis className="size-5" aria-hidden="true" />
                <span>More</span>
              </MenuTrigger>
              <MenuPopup align="end" className="w-52">
                <MenuItem closeOnClick onClick={() => void handleToggleMute()}>
                  {isMuted ? <Bell /> : <BellOff />}
                  <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                </MenuItem>

                {canStartSecretChat ? (
                  <MenuItem closeOnClick onClick={() => void handleStartSecretChat()}>
                    <Lock />
                    <span>Start Secret Chat</span>
                  </MenuItem>
                ) : null}

                {canManageContact ? (
                  <MenuItem closeOnClick onClick={() => setContactDialogOpen(true)}>
                    {isContact ? <Pencil /> : <UserPlus />}
                    <span>{isContact ? 'Edit Contact' : 'Add Contact'}</span>
                  </MenuItem>
                ) : null}

                {canManageContact && isContact ? (
                  <MenuItem
                    closeOnClick
                    variant="destructive"
                    onClick={() => void handleDeleteContact()}
                  >
                    <UserMinus />
                    <span>Delete Contact</span>
                  </MenuItem>
                ) : null}

                {canBlock ? (
                  <>
                    <MenuSeparator />
                    <MenuItem
                      closeOnClick
                      variant={isBlocked ? undefined : 'destructive'}
                      onClick={() => void handleToggleBlock()}
                    >
                      <Ban />
                      <span>{isBlocked ? 'Unblock User' : 'Block User'}</span>
                    </MenuItem>
                  </>
                ) : null}
              </MenuPopup>
            </Menu>
          </div>

          {/* Linked Personal Channel */}
          {userFull?.personalChannelId ? (
            <UserProfileChannelCard
              personalChannelId={userFull.personalChannelId}
              personalChannelMessageId={userFull.personalChannelMessage}
            />
          ) : null}

          {/* User details & inline actions card */}
          {hasInfoCardRows ? (
            <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60 bg-card">
              {formattedPhone ? (
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">mobile</p>
                    <p className="mt-0.5 truncate text-sm text-primary">{formattedPhone}</p>
                  </div>
                  <CopyButton
                    value={formattedPhone}
                    aria-label="Copy phone number"
                    onCopyError={() => toast.error('Failed to copy phone number')}
                  />
                </div>
              ) : null}

              {primaryUsername ? (
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">username</p>
                    <p className="mt-0.5 truncate text-sm text-primary">@{primaryUsername}</p>
                    {extraUsernames.length > 0 ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        also {extraUsernames.map((uname) => `@${uname}`).join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <CopyButton
                    value={`@${primaryUsername}`}
                    aria-label="Copy username"
                    onCopyError={() => toast.error('Failed to copy username')}
                  />
                </div>
              ) : null}

              {bioText ? (
                <div className="px-4 py-3">
                  <p className="mb-0.5 text-xs text-primary">bio</p>
                  <UserProfileBioText text={bioText} />
                </div>
              ) : null}

              {birthdayText ? (
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">date of birth</p>
                  <p className="mt-0.5 text-sm text-foreground">{birthdayText}</p>
                </div>
              ) : null}

              {canManageContact && !isContact ? (
                <button
                  type="button"
                  onClick={() => setContactDialogOpen(true)}
                  className="flex w-full cursor-pointer items-center px-4 py-3 text-left text-sm font-normal text-primary transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:bg-accent/50"
                >
                  Add Contact
                </button>
              ) : null}

              {canBlock ? (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void handleToggleBlock()}
                  className="flex w-full cursor-pointer items-center px-4 py-3 text-left text-sm font-normal text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:bg-destructive/10 disabled:opacity-50"
                >
                  {isBlocked ? 'Unblock User' : 'Block User'}
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Peer ID card */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
                PEER ID
              </p>
              <p className="mt-0.5 truncate font-mono text-sm text-foreground">{peerId}</p>
            </div>
            <CopyButton
              value={peerId}
              aria-label="Copy peer ID"
              onCopyError={() => toast.error('Failed to copy peer ID')}
            />
          </div>
        </div>
      </ScrollArea>

      <UserContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        userId={peerId}
        initialFirstName={user?.firstName ?? display.name}
        initialLastName={user?.lastName ?? ''}
        phone={user?.phone}
        isEdit={isContact}
        defaultSharePhone={Boolean(userFull?.settings?.needContactsException)}
      />

      <BlockUserDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        userId={peerId}
        displayName={display.name}
      />
    </div>
  );
});

export default UserProfileView;
