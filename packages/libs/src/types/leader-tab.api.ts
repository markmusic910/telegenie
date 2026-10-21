/**
 * Typed API the leader tab exposes to the Service Worker over the
 * `sw-leader` MessageChannel bridge (worker-rpc). Hosted only by the elected
 * leader tab (`LeaderTab` in the SDK SwModule).
 */

/** Deep-link payload when the user clicks an OS notification. */
export type FocusMessagePayload = {
  chatId?: string;
  messageId?: number;
  reaction?: string;
  shouldReplaceHistory?: boolean;
};

export type LeaderTabApi = {
  ping: { args: []; result: 'pong' };
  playNotificationSound: { args: [id: string]; result: void };
  /** Focus the leader window and navigate to the message (leader tab only). */
  focusMessage: { args: [payload: FocusMessagePayload]; result: void };
};
