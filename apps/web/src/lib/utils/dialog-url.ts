export const DIALOG_ROUTE_PREFIX = '/chat';
export const CONTACTS_ROUTE_PREFIX = '/contacts';

/** Build the canonical URL path for a dialog id, or `/` when none is selected. */
export function dialogHref(dialogId?: string | null): string {
  const trimmed = dialogId?.trim();
  if (!trimmed) return '/';
  return `${DIALOG_ROUTE_PREFIX}/${encodeURIComponent(trimmed)}`;
}

/** Build the canonical contacts URL path for a dialog id, or `/contacts` when none is selected. */
export function contactsHref(dialogId?: string | null): string {
  const trimmed = dialogId?.trim();
  if (!trimmed) return CONTACTS_ROUTE_PREFIX;
  return `${CONTACTS_ROUTE_PREFIX}/${encodeURIComponent(trimmed)}`;
}

function extractFirstSegmentAfterPrefix(pathname: string, prefix: string): string | undefined {
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

/**
 * Extract and decode the dialog id from `/chat/<dialogId>` or `/contacts/<dialogId>`,
 * or `undefined` if not a dialog-scoped URL.
 */
export function parseDialogIdFromPathname(pathname: string | null | undefined): string | undefined {
  if (!pathname) return undefined;
  return (
    extractFirstSegmentAfterPrefix(pathname, `${DIALOG_ROUTE_PREFIX}/`) ??
    extractFirstSegmentAfterPrefix(pathname, `${CONTACTS_ROUTE_PREFIX}/`)
  );
}

/** Whether the pathname belongs to the main chats view (`/` or `/chat/...`). */
export function isChatsPathname(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === '/' || pathname.startsWith(`${DIALOG_ROUTE_PREFIX}/`);
}

/** Whether the pathname belongs to the contacts view (`/contacts` or `/contacts/...`). */
export function isContactsPathname(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === CONTACTS_ROUTE_PREFIX || pathname.startsWith(`${CONTACTS_ROUTE_PREFIX}/`);
}
