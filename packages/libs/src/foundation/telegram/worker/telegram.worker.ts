import { Buffer } from 'buffer';
import { exposeSharedWorkerApi, exposeWorkerApi, type ExposedWorkerApi } from '../../worker-rpc';
import { Telegram } from '../telegram';
import {
  BRIDGE_KIND_INIT,
  BRIDGE_LINK_SW_TELEGRAM,
  BRIDGE_READY_MESSAGE,
  createMessagePortSession,
  getBridgeLink,
  type BridgeMessage,
  type MessagePortSession,
} from './sw-bridge-protocol';
import type { TelegramWorkerApi, TelegramWorkerEvents } from './telegram.api';
import { createTelegramWorkerHandlers } from './telegram.handlers';

if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;
}

const debug = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

const tg = new Telegram({ debug });
const handlers = createTelegramWorkerHandlers(tg);

let swBridge: MessagePortSession | undefined;
let swBridgeRpc: ExposedWorkerApi<TelegramWorkerEvents> | undefined;

const { emit } = exposeSharedWorkerApi<TelegramWorkerApi, TelegramWorkerEvents>({
  handlers,
  tag: 'telegram-worker',
  onConnect: (port) => {
    // NOTE: SW ↔ Telegram SharedWorker bridge handshake only — normal tabs never send BRIDGE_KIND_INIT.
    const onBridgeHandshakeMessage = (ev: MessageEvent) => {
      const data = ev.data as BridgeMessage | undefined;
      if (data?.kind !== BRIDGE_KIND_INIT) {
        return;
      }
      const link = getBridgeLink(data);
      if (link && link !== BRIDGE_LINK_SW_TELEGRAM) {
        return;
      }
      const bridgePort = ev.ports?.[0];
      if (!bridgePort) {
        return;
      }
      swBridgeRpc?.dispose();
      swBridge?.close();

      // Same MessagePort, two layers:
      // - swBridge: bridge protocol helper (start / post bridge.ready / close) + diagnostics handle
      // - swBridgeRpc: worker-rpc host so the Service Worker can call TelegramWorkerApi on this port
      swBridge = createMessagePortSession(bridgePort);
      // Why we need this? Because we need to expose the TelegramWorkerApi to the Service Worker, just like tab page calls it, so the Service Worker can call TelegramWorkerApi on this port.
      swBridgeRpc = exposeWorkerApi<TelegramWorkerApi, TelegramWorkerEvents>({
        handlers,
        port: bridgePort,
        tag: 'telegram-sw-bridge',
      });
      // Notify the Service Worker that the bridge is ready.
      // NOTE: right now we don't have a hard handshake to confirm the bridge is ready, so we just post the message to the Service Worker.
      swBridge.post(BRIDGE_READY_MESSAGE);
      // Notify the tab page that the bridge is ready.
      port.postMessage(BRIDGE_READY_MESSAGE);
    };
    port.addEventListener('message', onBridgeHandshakeMessage);
  },
});

tg.subscribeEntityChanges((change) => {
  emit('entityChange', change);
});

tg.subscribeMessageNotifications((payload) => {
  emit('messageNotification', payload);
  swBridgeRpc?.emit('messageNotification', payload);
});

tg.subscribeStoreUpdates((payload) => {
  emit('storeUpdate', payload);
});

tg.subscribeDialogOrder((payload) => {
  emit('dialogOrder', payload);
});

/** Exposed for tests / internal SW bridge diagnostics. */
export function getServiceWorkerBridge(): MessagePortSession | undefined {
  return swBridge;
}
