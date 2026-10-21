import type { TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';
import {
  BRIDGE_INIT_SW_LEADER,
  BRIDGE_INIT_SW_TELEGRAM,
  createMessageChannelPair,
} from '@telegenie/libs/foundation/telegram/worker/sw-bridge-protocol';
import {
  exposeWorkerApi,
  type ExposedWorkerApi,
  type RpcHandlers,
} from '@telegenie/libs/foundation/worker-rpc';
import type { FocusMessagePayload, LeaderTabApi } from '@telegenie/libs/types/leader-tab.api';

export type { FocusMessagePayload, LeaderTabApi };

export type LeaderTabOptions = {
  /** Must return true only for the elected leader tab. */
  isLeader: () => boolean;
  onFocusMessage?: (payload: FocusMessagePayload) => void;
};

/**
 * Leader-tab side of the SW `sw-leader` bridge: hosts {@link LeaderTabApi} over
 * worker-rpc and brokers MessageChannels to the Service Worker / Telegram SharedWorker.
 *
 * Only construct/connect while this tab is leader; followers must not call {@link connect}.
 */
export class LeaderTab {
  private readonly isLeader: () => boolean;
  private readonly onFocusMessage?: (payload: FocusMessagePayload) => void;
  private rpcHost: ExposedWorkerApi<Record<string, never>> | undefined;
  private bridgeCloser: (() => void) | undefined;

  constructor(options: LeaderTabOptions) {
    this.isLeader = options.isLeader;
    this.onFocusMessage = options.onFocusMessage;
  }

  /**
   * Transfer SW↔Telegram and SW↔leader ports; expose {@link LeaderTabApi} so the
   * Service Worker can call playNotificationSound / focusMessage on this tab only.
   */
  async connect(telegramWorker: TelegramWorkerClient): Promise<void> {
    if (!this.isLeader()) {
      return;
    }

    this.disconnect();

    const controller =
      typeof navigator !== 'undefined' ? navigator.serviceWorker?.controller : null;
    if (!controller) {
      console.warn('[LeaderTab] Cannot connect bridges: navigator.serviceWorker.controller is not ready yet');
      return;
    }

    console.log('[LeaderTab] Connecting SW↔Telegram and SW↔Leader bridges...');
    const telegram = createMessageChannelPair();
    const leader = createMessageChannelPair();

    this.rpcHost = exposeWorkerApi<LeaderTabApi>({
      handlers: this.createHandlers(),
      port: leader.port1,
      tag: 'leader-tab',
    });
    leader.port1.start();

    telegramWorker.worker.postMessage(BRIDGE_INIT_SW_TELEGRAM, [telegram.port1]);
    controller.postMessage(BRIDGE_INIT_SW_TELEGRAM, [telegram.port2]);
    controller.postMessage(BRIDGE_INIT_SW_LEADER, [leader.port2]);
    console.log('[LeaderTab] SW bridges transferred successfully');

    this.bridgeCloser = () => {
      this.rpcHost?.dispose();
      this.rpcHost = undefined;
      for (const port of [telegram.port1, telegram.port2, leader.port1, leader.port2]) {
        try {
          port.close();
        } catch {
          // ignore
        }
      }
    };
  }

  disconnect(): void {
    this.bridgeCloser?.();
    this.bridgeCloser = undefined;
  }

  /** worker-rpc surface invoked by the Service Worker on this leader tab. */
  private createHandlers(): RpcHandlers<LeaderTabApi> {
    return {
      ping: async () => this.ping(),
      playNotificationSound: async (id) => this.playNotificationSound(id),
      focusMessage: async (payload) => this.focusMessage(payload),
    };
  }

  private async ping(): Promise<'pong'> {
    return 'pong';
  }

  private async playNotificationSound(_id: string): Promise<void> {
    if (!this.isLeader()) return;
    if (typeof Audio === 'undefined') return;
    try {
      const audio = new Audio('/notification.mp3');
      await audio.play();
    } catch {
      // Autoplay / missing asset — ignore.
    }
  }

  private async focusMessage(payload: FocusMessagePayload): Promise<void> {
    if (!this.isLeader()) return;
    try {
      window.focus();
    } catch {
      // ignore
    }
    this.onFocusMessage?.(payload);
  }
}
