/**
 * SW MessageChannel bridge handshake (port delivery; not worker-rpc).
 * Shared by Telegram SharedWorker, Service Worker, and SDK leader brokering.
 */

export const BRIDGE_KIND_INIT = 'bridge.init' as const;
export const BRIDGE_KIND_READY = 'bridge.ready' as const;
export const BRIDGE_KIND_CLOSE = 'bridge.close' as const;

export type BridgeMessageKind =
  | typeof BRIDGE_KIND_INIT
  | typeof BRIDGE_KIND_READY
  | typeof BRIDGE_KIND_CLOSE;

/**
 * Which MessageChannel pair is being established (both endpoints).
 * - {@link BRIDGE_LINK_SW_TELEGRAM} — Service Worker ↔ Telegram SharedWorker
 * - {@link BRIDGE_LINK_SW_LEADER} — Service Worker ↔ leader tab page
 */
export const BRIDGE_LINK_SW_TELEGRAM = 'sw-telegram' as const;
export const BRIDGE_LINK_SW_LEADER = 'sw-leader' as const;

export type BridgeLink = typeof BRIDGE_LINK_SW_TELEGRAM | typeof BRIDGE_LINK_SW_LEADER;

export type BridgeInitPayload = {
  link: BridgeLink;
};

export type BridgeMessage<T = unknown> = {
  kind: BridgeMessageKind;
  payload?: T;
};

export type MessagePortSession = {
  port: MessagePort;
  post: <T = unknown>(message: BridgeMessage<T>, transfer?: Transferable[]) => void;
  on: (handler: (message: BridgeMessage, ev: MessageEvent) => void) => () => void;
  close: () => void;
};

export function createMessageChannelPair(): {
  port1: MessagePort;
  port2: MessagePort;
  channel: MessageChannel;
} {
  if (typeof MessageChannel === 'undefined') {
    throw new Error('createMessageChannelPair requires MessageChannel');
  }
  const channel = new MessageChannel();
  return { port1: channel.port1, port2: channel.port2, channel };
}

export function createMessagePortSession(port: MessagePort): MessagePortSession {
  port.start();

  return {
    port,
    post(message, transfer) {
      port.postMessage(message, transfer ?? []);
    },
    on(handler) {
      const listener = (ev: MessageEvent) => {
        const data = ev.data as BridgeMessage | undefined;
        if (!data || typeof data !== 'object' || typeof data.kind !== 'string') {
          return;
        }
        handler(data, ev);
      };
      port.addEventListener('message', listener);
      return () => port.removeEventListener('message', listener);
    },
    close() {
      port.close();
    },
  };
}

/** Well-known messages used when transferring a bridge port to SharedWorker / SW. */
export const BRIDGE_INIT_MESSAGE = { kind: BRIDGE_KIND_INIT } as const;
export const BRIDGE_READY_MESSAGE = { kind: BRIDGE_KIND_READY } as const;
export const BRIDGE_CLOSE_MESSAGE = { kind: BRIDGE_KIND_CLOSE } as const;

export function createBridgeInitMessage(link: BridgeLink): BridgeMessage<BridgeInitPayload> {
  return { kind: BRIDGE_KIND_INIT, payload: { link } };
}

/** Pre-built `bridge.init` for SW ↔ Telegram SharedWorker. */
export const BRIDGE_INIT_SW_TELEGRAM = createBridgeInitMessage(BRIDGE_LINK_SW_TELEGRAM);

/** Pre-built `bridge.init` for SW ↔ leader tab. */
export const BRIDGE_INIT_SW_LEADER = createBridgeInitMessage(BRIDGE_LINK_SW_LEADER);

export function getBridgeLink(
  message: BridgeMessage | null | undefined,
): BridgeLink | undefined {
  if (!message || message.kind !== BRIDGE_KIND_INIT) {
    return undefined;
  }
  const link = (message.payload as BridgeInitPayload | undefined)?.link;
  if (link === BRIDGE_LINK_SW_TELEGRAM || link === BRIDGE_LINK_SW_LEADER) {
    return link;
  }
  // Legacy handshake without payload / old single-sided names.
  const legacy = (message.payload as { target?: string } | undefined)?.target;
  if (legacy === 'telegram' || legacy === undefined) {
    return BRIDGE_LINK_SW_TELEGRAM;
  }
  if (legacy === 'leader') {
    return BRIDGE_LINK_SW_LEADER;
  }
  return BRIDGE_LINK_SW_TELEGRAM;
}
