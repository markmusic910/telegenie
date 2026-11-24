export const DIALOG_ROUTE_PREFIX = '/chat';

/** Build the canonical URL path for a dialog id, or `/` when none is selected. */
export function dialogHref(dialogId?: string | null): string {
  const trimmed = dialogId?.trim();
  if (!trimmed) return '/';
  return `${DIALOG_ROUTE_PREFIX}/${encodeURIComponent(trimmed)}`;
}

/** Extract and decode the dialog id from `/chat/<dialogId>`, or `undefined` if not a dialog URL. */
export function parseDialogIdFromPathname(pathname: string | null | undefined): string | undefined {
  if (!pathname) return undefined;
  const prefix = `${DIALOG_ROUTE_PREFIX}/`;
  if (!pathname.startsWith(prefix)) return undefined;
  const rest = pathname.slice(prefix.length);
  if (!rest) return undefined;
  const segment = rest.split('/')[0];
  if (!segment) return undefined;
  try {
    const decoded = decodeURIComponent(segment).trim();
    return decoded || undefined;
  } catch {
    return segment.trim() || undefined;
  }
}

/** Whether the pathname belongs to the main chats view (`/` or `/chat/...`). */
export function isChatsPathname(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === '/' || pathname.startsWith(`${DIALOG_ROUTE_PREFIX}/`);
}
