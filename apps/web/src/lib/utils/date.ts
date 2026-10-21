import type { TypeUserStatus } from '@telegenie/libs/foundation/telegram/types/users';


const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatShortDate(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * Telegram-style reaction time: “today at HH:mm”, “yesterday at …”, weekday, or DD/MM/YYYY.
 */
export function formatReactionTimestamp(unixSeconds: number, now = new Date()): string {
  if (!unixSeconds) return '';
  const date = new Date(unixSeconds * 1000);
  const today = startOfLocalDay(now);
  const thatDay = startOfLocalDay(date);
  const dayDiff = Math.round((today - thatDay) / 86_400_000);
  const time = formatTime(date);
  if (dayDiff === 0) return `today at ${time}`;
  if (dayDiff === 1) return `yesterday at ${time}`;
  if (dayDiff > 1 && dayDiff < 7) return `${WEEKDAYS[date.getDay()]} at ${time}`;
  return `${formatShortDate(date)} at ${time}`;
}

export function formatPastTimeShort(unixSeconds: number, now = new Date()): string {
  if (!unixSeconds) return '';
  const date = new Date(unixSeconds * 1000);
  const today = startOfLocalDay(now);
  const thatDay = startOfLocalDay(date);
  const dayDiff = Math.round((today - thatDay) / 86_400_000);

  if (dayDiff <= 0) return formatTime(date);
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return WEEKDAYS[date.getDay()] ?? formatShortDate(date);
  return formatShortDate(date);
}


export function formatUserStatus(status?: TypeUserStatus): string {
  if (!status) return 'last seen long time ago';
  switch (status.className) {
    case 'UserStatusOnline':
      return 'online';
    case 'UserStatusOffline': {
      const date = new Date(status.wasOnline * 1000);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) {
        return `last seen today at ${timeStr}`;
      }
      if (isYesterday) {
        return `last seen yesterday at ${timeStr}`;
      }
      return `last seen ${date.toLocaleDateString()}`;
    }
    case 'UserStatusRecently':
      return 'last seen recently';
    case 'UserStatusLastWeek':
      return 'last seen within a week';
    case 'UserStatusLastMonth':
      return 'last seen within a month';
    case 'UserStatusEmpty':
    default:
      return 'last seen long time ago';
  }
}
