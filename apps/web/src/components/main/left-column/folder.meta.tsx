'use client';

import CustomEmoji from '@/lib/components/custom.emoji';
import {
  ALL_CHATS_FOLDER_ID,
  isUnreadFolder,
  type CustomEmojiEntity,
  type DialogFilterEntity,
} from '@telegenie/sdk';
import type { ReactNode } from 'react';
import {
  Archive,
  Bell,
  BellOff,
  Bot,
  Briefcase,
  CheckCheck,
  Flame,
  Folder,
  Gamepad2,
  GraduationCap,
  Heart,
  Home,
  Lightbulb,
  MailOpen,
  Megaphone,
  MessagesSquare,
  Music,
  Plane,
  Star,
  User,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type FolderColorOption = {
  /** Telegram `dialogFilter.color` integer (0..6). */
  id: number;
  label: string;
  /** Solid circle swatch color in the picker & folder list. */
  swatchClass: string;
  /** Soft pill styling for folder tags in the chat list & color preview. */
  tagClass: string;
};

/**
 * Telegram's 7 folder tag colors (`dialogFilter.color` 0..6):
 * 0 Red, 1 Orange, 2 Violet/Purple, 3 Green, 4 Cyan/Teal, 5 Blue, 6 Pink.
 */
export const FOLDER_COLORS: readonly FolderColorOption[] = [
  {
    id: 0,
    label: 'Red',
    swatchClass: 'bg-rose-400',
    tagClass: 'bg-rose-500/18 text-rose-600 dark:text-rose-300',
  },
  {
    id: 1,
    label: 'Orange',
    swatchClass: 'bg-amber-300',
    tagClass: 'bg-amber-500/18 text-amber-700 dark:text-amber-300',
  },
  {
    id: 2,
    label: 'Purple',
    swatchClass: 'bg-indigo-400',
    tagClass: 'bg-indigo-500/18 text-indigo-600 dark:text-indigo-300',
  },
  {
    id: 3,
    label: 'Green',
    swatchClass: 'bg-emerald-400',
    tagClass: 'bg-emerald-500/18 text-emerald-700 dark:text-emerald-300',
  },
  {
    id: 4,
    label: 'Teal',
    swatchClass: 'bg-teal-300',
    tagClass: 'bg-teal-500/18 text-teal-700 dark:text-teal-300',
  },
  {
    id: 5,
    label: 'Blue',
    swatchClass: 'bg-sky-400',
    tagClass: 'bg-sky-500/18 text-sky-700 dark:text-sky-300',
  },
  {
    id: 6,
    label: 'Pink',
    swatchClass: 'bg-fuchsia-400',
    tagClass: 'bg-fuchsia-500/18 text-fuchsia-700 dark:text-fuchsia-300',
  },
];

export function getFolderColor(color: number | undefined): FolderColorOption | undefined {
  if (color === undefined) return undefined;
  return FOLDER_COLORS.find((item) => item.id === color);
}

export type FolderIconPreset = {
  /** Telegram `dialogFilter.emoticon` value. */
  emoticon: string;
  label: string;
  Icon: LucideIcon;
};

/**
 * Standard Telegram folder icon presets mapped to their canonical `emoticon`
 * strings so icons stay interoperable with official Telegram desktop/mobile apps.
 */
export const FOLDER_ICON_PRESETS: readonly FolderIconPreset[] = [
  { emoticon: '📁', label: 'Folder', Icon: Folder },
  { emoticon: '💬', label: 'Chats', Icon: MessagesSquare },
  { emoticon: '✅', label: 'Unread', Icon: MailOpen },
  { emoticon: '👤', label: 'Contacts', Icon: User },
  { emoticon: '👥', label: 'Groups', Icon: Users },
  { emoticon: '📢', label: 'Channels', Icon: Megaphone },
  { emoticon: '🤖', label: 'Bots', Icon: Bot },
  { emoticon: '⭐', label: 'Star', Icon: Star },
  { emoticon: '❤️', label: 'Heart', Icon: Heart },
  { emoticon: '🔔', label: 'Bell', Icon: Bell },
  { emoticon: '🔥', label: 'Fire', Icon: Flame },
  { emoticon: '💼', label: 'Work', Icon: Briefcase },
  { emoticon: '🏠', label: 'Home', Icon: Home },
  { emoticon: '🎓', label: 'Study', Icon: GraduationCap },
  { emoticon: '🎮', label: 'Games', Icon: Gamepad2 },
  { emoticon: '✈️', label: 'Travel', Icon: Plane },
  { emoticon: '🎵', label: 'Music', Icon: Music },
  { emoticon: '💡', label: 'Ideas', Icon: Lightbulb },
];

const EMOTICON_TO_ICON = new Map<string, LucideIcon>(
  FOLDER_ICON_PRESETS.map((preset) => [preset.emoticon, preset.Icon]),
);

export const INCLUDE_CHAT_TYPE_OPTIONS = [
  { id: 'contacts', label: 'Contacts', Icon: User },
  { id: 'nonContacts', label: 'Non-Contacts', Icon: UserRound },
  { id: 'groups', label: 'Groups', Icon: Users },
  { id: 'broadcasts', label: 'Channels', Icon: Megaphone },
  { id: 'bots', label: 'Bots', Icon: Bot },
] as const;

export const EXCLUDE_CHAT_TYPE_OPTIONS = [
  { id: 'excludeMuted', label: 'Muted', Icon: BellOff },
  { id: 'excludeRead', label: 'Read', Icon: CheckCheck },
  { id: 'excludeArchived', label: 'Archived', Icon: Archive },
] as const;

export function FolderGlyph({
  filter,
  emoticon,
  className = 'size-5 shrink-0',
}: {
  filter?: Pick<
    DialogFilterEntity,
    | 'id'
    | 'isDefault'
    | 'isChatlist'
    | 'emoticon'
    | 'contacts'
    | 'nonContacts'
    | 'groups'
    | 'broadcasts'
    | 'bots'
    | 'excludeRead'
  >;
  emoticon?: string;
  className?: string;
}) {
  if (filter?.id === ALL_CHATS_FOLDER_ID) {
    return <MessagesSquare className={className} />;
  }
  if (filter && isUnreadFolder(filter as DialogFilterEntity)) {
    return <MailOpen className={className} />;
  }

  const effectiveEmoticon = emoticon ?? filter?.emoticon;
  if (effectiveEmoticon) {
    const Mapped = EMOTICON_TO_ICON.get(effectiveEmoticon);
    if (Mapped) {
      return <Mapped className={className} />;
    }
    return (
      <span className="inline-flex items-center justify-center text-lg leading-none" aria-hidden="true">
        {effectiveEmoticon}
      </span>
    );
  }

  if (filter?.groups) return <Users className={className} />;
  if (filter?.broadcasts) return <Megaphone className={className} />;
  if (filter?.bots) return <Bot className={className} />;
  if (filter?.contacts || filter?.nonContacts) return <User className={className} />;
  return <Folder className={className} />;
}

/**
 * Renders a folder title with inline custom/animated emoji entities (`MessageEntityCustomEmoji`).
 */
export function FolderTitleText({
  title,
  entities,
  emojiSize = 16,
}: {
  title: string;
  entities?: CustomEmojiEntity[];
  emojiSize?: number;
}) {
  if (!entities?.length) return <>{title}</>;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const entity of [...entities].sort((a, b) => a.offset - b.offset)) {
    if (entity.offset < cursor || entity.offset + entity.length > title.length) continue;
    if (entity.offset > cursor) nodes.push(title.slice(cursor, entity.offset));
    const fallback = title.slice(entity.offset, entity.offset + entity.length);
    nodes.push(
      <span
        key={`${entity.offset}:${entity.documentId}`}
        className="inline-flex items-center align-text-bottom"
      >
        <CustomEmoji
          documentId={entity.documentId}
          fallback={fallback}
          size={emojiSize}
          placeholder={false}
        />
      </span>,
    );
    cursor = entity.offset + entity.length;
  }
  if (cursor < title.length) nodes.push(title.slice(cursor));
  return <>{nodes}</>;
}

/** Extract error message from either a thrown Error or an SDK `@Method()` error envelope. */
export function extractControllerError(resultOrError: unknown): string | undefined {
  if (!resultOrError) return undefined;
  if (resultOrError instanceof Error) return resultOrError.message;
  if (typeof resultOrError === 'object' && 'success' in resultOrError) {
    const envelope = resultOrError as { success?: boolean; error?: { message?: string } };
    if (envelope.success === false) {
      return envelope.error?.message || 'Operation failed';
    }
  }
  return undefined;
}

export function formatFolderErrorMessage(raw: string): string {
  const upper = raw.toUpperCase();
  if (upper.includes('PREMIUM_ACCOUNT_REQUIRED')) {
    return 'This feature requires Telegram Premium.';
  }
  if (upper.includes('DIALOG_FILTERS_TOO_MUCH')) {
    return 'You have reached the maximum number of folders for your account.';
  }
  if (upper.includes('FILTER_INCLUDE_EMPTY')) {
    return 'Please include at least one chat or chat type.';
  }
  if (upper.includes('FILTER_TITLE_EMPTY')) {
    return 'Please enter a folder name.';
  }
  if (upper.includes('CHATLIST_EXCLUDE_INVALID')) {
    return 'Shared folders cannot have excluded chats.';
  }
  return raw;
}
