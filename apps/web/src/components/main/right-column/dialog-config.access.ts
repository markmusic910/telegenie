type AdminRights = Record<string, boolean | undefined>;

type PeerAccess = {
  creator?: boolean;
  adminRights?: AdminRights;
};

/**
 * `messages.setChatAvailableReactions` requires an admin (`CHAT_ADMIN_REQUIRED`).
 * On `chat` / `channel`, that is `creator`, or a present `admin_rights` bitmask
 * (basic groups often send only `creator`).
 * @see https://core.telegram.org/constructor/chat
 */
export function canConfigureDialog(input: { chat?: PeerAccess; channel?: PeerAccess }): boolean {
  return isPeerAdmin(input.chat) || isPeerAdmin(input.channel);
}

function isPeerAdmin(peer?: PeerAccess): boolean {
  if (!peer) return false;
  if (peer.creator) return true;
  return hasAdminRights(peer.adminRights);
}

function hasAdminRights(rights?: AdminRights): boolean {
  if (!rights) return false;
  return Object.values(rights).some(Boolean);
}
