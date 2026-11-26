import {
  createBroadcastBus,
  DEFAULT_BROADCAST_CHANNEL_NAME,
  LEADER_HEARTBEAT_TTL_MS,
  TAB_MSG,
  type BroadcastBus,
} from '@telegenie/libs/foundation/broadcast-channel';
import type {
  TelegramWorkerApi,
  TelegramWorkerEvents,
} from '@telegenie/libs/foundation/telegram/worker';
import {
  BRIDGE_KIND_INIT,
  BRIDGE_LINK_SW_TELEGRAM,
  BRIDGE_READY_MESSAGE,
  BRIDGE_REQUEST_MESSAGE,
  getBridgeLink,
  type BridgeLink,
  type BridgeMessage,
} from '@telegenie/libs/foundation/telegram/worker/sw-bridge-protocol';
import { createWorkerClient, type WorkerClient } from '@telegenie/libs/foundation/worker-rpc';
import type { LeaderTabApi } from '@telegenie/libs/types/leader-tab.api';
import { sleep } from '@telegenie/libs/utils/scheduler';

import { DEBUG } from './constants';
import { FetchManager } from './fetch-manager';
import { NotificationManager } from './notification-manager';

declare const self: ServiceWorkerGlobalScope;

const ACTIVATE_TIMEOUT = 3000;
const BRIDGE_RECONNECT_TIMEOUT_MS = 5000;

type RpcSlot<
  P extends Record<string, { args: unknown[]; result: unknown }>,
  E extends Record<string, unknown> = Record<string, never>,
> = {
  port: MessagePort;
  client: WorkerClient<P, E>;
};

/**
 * Service Worker facade: lifecycle listeners, BroadcastChannel leader observation,
 * and typed worker-rpc clients over leader-brokered MessagePorts (Telegram
 * SharedWorker + leader tab). Fetch/media strategies live in {@link FetchManager}.
 *
 * Page `postMessage` accepts `bridge.init` + transferred ports (leader brokers).
 * Progressive/download byte parts use Telegram SharedWorker `file.getPart` over
 * the `sw-telegram` bridge. Ongoing SW↔leader / SW↔Telegram traffic uses
 * worker-rpc on those ports.
 */
export class TeleGenieServiceWorker {
  private initialized = false;
  private broadcast: BroadcastBus | undefined;
  private readonly leaderUnsubscribers: Array<() => void> = [];

  private _leaderTabId: string | undefined;
  private leaderHeartbeatAt = 0;

  private telegramSlot: RpcSlot<TelegramWorkerApi, TelegramWorkerEvents> | undefined;
  private leaderSlot: RpcSlot<LeaderTabApi> | undefined;
  private unsubTelegramNotifications: (() => void) | undefined;
  private pendingTelegramBridge:
    | Promise<WorkerClient<TelegramWorkerApi, TelegramWorkerEvents> | undefined>
    | undefined;
  private resolvePendingTelegramBridge:
    | ((client: WorkerClient<TelegramWorkerApi, TelegramWorkerEvents> | undefined) => void)
    | undefined;

  private readonly notifications = new NotificationManager({
    getLeaderRpc: () => this.leaderRpc,
  });

  private readonly fetchManager = new FetchManager({
    getTelegramRpc: () => this.telegramRpc,
    ensureTelegramRpc: () => this.ensureTelegramRpc(),
  });

  get leaderTabId(): string | undefined {
    return this._leaderTabId;
  }

  get telegramRpc(): WorkerClient<TelegramWorkerApi, TelegramWorkerEvents> | undefined {
    return this.telegramSlot?.client;
  }

  get leaderRpc(): WorkerClient<LeaderTabApi> | undefined {
    return this.leaderSlot?.client;
  }

  init(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    this.initLeaderTracker();
    this.initLifecycleListeners();
    this.fetchManager.init();
    this.notifications.init();
    this.initBridgeMessageListener();
    // If the browser restarted an idle SW while tabs are still open, ask the
    // leader tab to re-attach the MessagePort bridges proactively.
    void this.requestBridgeReconnect();
  }

  private initLeaderTracker(): void {
    this.broadcast = createBroadcastBus({ name: DEFAULT_BROADCAST_CHANNEL_NAME });

    this.leaderUnsubscribers.push(
      this.broadcast.on<{ tabId: string; heartbeatAt: number }>(TAB_MSG.heartbeat, (env) => {
        const { tabId, heartbeatAt } = env.payload;
        if (!tabId) return;
        if (this._leaderTabId === tabId || !this.isLeaderFresh()) {
          this.setLeader(tabId, heartbeatAt);
        }
      }),
      this.broadcast.on<{ tabId: string; heartbeatAt?: number }>(TAB_MSG.leaderClaim, (env) => {
        const claimer = env.payload.tabId;
        if (!claimer) return;
        this.onLeaderClaim(claimer, env.payload.heartbeatAt);
      }),
      this.broadcast.on<{ tabId: string }>(TAB_MSG.leaderResign, (env) => {
        if (env.payload.tabId && env.payload.tabId === this._leaderTabId) {
          this.clearLeader();
          this.disposeLeaderBridge();
        }
      }),
    );
  }

  private isLeaderFresh(now = Date.now()): boolean {
    if (!this._leaderTabId) return false;
    return now - this.leaderHeartbeatAt <= LEADER_HEARTBEAT_TTL_MS;
  }

  private setLeader(tabId: string, heartbeatAt = Date.now()): void {
    const previous = this._leaderTabId;
    this._leaderTabId = tabId;
    this.leaderHeartbeatAt = heartbeatAt;
    if (previous && previous !== tabId) {
      this.disposeLeaderBridge();
    }
  }

  private clearLeader(): void {
    this._leaderTabId = undefined;
    this.leaderHeartbeatAt = 0;
  }

  private onLeaderClaim(claimer: string, heartbeatAt?: number): void {
    const at = heartbeatAt ?? Date.now();
    if (!this.isLeaderFresh() || claimer < (this._leaderTabId ?? '')) {
      this.setLeader(claimer, at);
      return;
    }
    if (this._leaderTabId === claimer) {
      this.leaderHeartbeatAt = at;
    }
  }

  private initLifecycleListeners(): void {
    self.addEventListener('install', (e) => {
      if (DEBUG) {
        console.log('ServiceWorker installed');
      }
      e.waitUntil(self.skipWaiting());
    });

    self.addEventListener('activate', (e) => {
      if (DEBUG) {
        console.log('ServiceWorker activated');
      }

      e.waitUntil(
        Promise.race([
          sleep(ACTIVATE_TIMEOUT),
          Promise.all([this.fetchManager.clearAssetCache(), self.clients.claim()]),
        ]),
      );
    });
  }

  /**
   * Page messages: `bridge.init` (+ ports) only.
   * Progressive/download parts use worker-rpc `file.getPart` on the telegram bridge.
   */
  private initBridgeMessageListener(): void {
    self.addEventListener('message', (event) => {
      const raw = event.data as BridgeMessage | { type?: string } | null;
      if (!raw || typeof raw !== 'object') {
        return;
      }

      if ('kind' in raw && raw.kind === BRIDGE_KIND_INIT) {
        if (DEBUG) {
          console.log('[SW] Received BRIDGE_KIND_INIT message:', raw);
        }
        this.acceptBridge(raw as BridgeMessage, event.ports?.[0]);
      }
    });
  }

  private acceptBridge(message: BridgeMessage, port: MessagePort | undefined): void {
    if (!port) {
      if (DEBUG) {
        console.warn('[SW] acceptBridge: Received bridge message without transferred port:', message);
      }
      return;
    }

    const link = getBridgeLink(message) ?? BRIDGE_LINK_SW_TELEGRAM;
    if (DEBUG) {
      console.log(`[SW] acceptBridge: Attaching RPC bridge for link "${link}"`);
    }
    this.attachRpcBridge(link, port);
    port.postMessage(BRIDGE_READY_MESSAGE);
  }

  private attachRpcBridge(link: BridgeLink, port: MessagePort): void {
    port.start();

    if (link === BRIDGE_LINK_SW_TELEGRAM) {
      this.disposeTelegramBridge();
      const client = createWorkerClient<TelegramWorkerApi, TelegramWorkerEvents>(port);
      this.telegramSlot = { port, client };
      if (DEBUG) {
        console.log('[SW] attachRpcBridge: Telegram SharedWorker bridge connected successfully');
      }
      this.unsubTelegramNotifications = client.on('messageNotification', (payload) => {
        void this.notifications.onTelegramMessageNotification(payload);
      });
      this.resolvePendingTelegramBridge?.(client);
      this.resolvePendingTelegramBridge = undefined;
      this.pendingTelegramBridge = undefined;
      return;
    }

    this.disposeLeaderBridge();
    const client = createWorkerClient<LeaderTabApi>(port);
    this.leaderSlot = { port, client };
    if (DEBUG) {
      console.log('[SW] attachRpcBridge: Leader tab bridge connected successfully');
    }
  }

  private disposeTelegramBridge(): void {
    this.unsubTelegramNotifications?.();
    this.unsubTelegramNotifications = undefined;
    if (!this.telegramSlot) return;
    try {
      this.telegramSlot.client.terminate();
    } catch {
      // ignore
    }
    this.telegramSlot = undefined;
  }

  private disposeLeaderBridge(): void {
    if (!this.leaderSlot) return;
    try {
      this.leaderSlot.client.terminate();
    } catch {
      // ignore
    }
    this.leaderSlot = undefined;
  }

  /**
   * Ensure the SW↔Telegram SharedWorker RPC bridge is connected.
   * When the browser terminates an idle SW and restarts it on a fetch event,
   * in-memory MessagePorts are lost; ask controlled tabs so the leader tab
   * re-brokers the bridges and await attachment.
   */
  private ensureTelegramRpc(
    timeoutMs = BRIDGE_RECONNECT_TIMEOUT_MS,
  ): Promise<WorkerClient<TelegramWorkerApi, TelegramWorkerEvents> | undefined> {
    if (this.telegramSlot) {
      return Promise.resolve(this.telegramSlot.client);
    }
    if (this.pendingTelegramBridge) {
      return this.pendingTelegramBridge;
    }

    this.pendingTelegramBridge = new Promise((resolve) => {
      let settled = false;
      const finish = (
        client: WorkerClient<TelegramWorkerApi, TelegramWorkerEvents> | undefined,
      ) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.resolvePendingTelegramBridge === finish) {
          this.resolvePendingTelegramBridge = undefined;
          this.pendingTelegramBridge = undefined;
        }
        resolve(client);
      };

      const timer = setTimeout(() => {
        finish(this.telegramSlot?.client);
      }, timeoutMs);

      this.resolvePendingTelegramBridge = finish;
      void this.requestBridgeReconnect();
    });

    return this.pendingTelegramBridge;
  }

  private async requestBridgeReconnect(): Promise<void> {
    try {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: false,
      });
      if (DEBUG && clients.length > 0) {
        console.log(
          `[SW] requestBridgeReconnect: requesting bridge from ${clients.length} window client(s)`,
        );
      }
      for (const client of clients) {
        client.postMessage(BRIDGE_REQUEST_MESSAGE);
      }
    } catch (err) {
      if (DEBUG) {
        console.warn('[SW] requestBridgeReconnect failed:', err);
      }
    }
  }
}
