import { Controller, Method, RequestLog } from '@telegenie/decorators';
import type { TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';
import {
  BRIDGE_KIND_REQUEST,
  type BridgeMessage,
} from '@telegenie/libs/foundation/telegram/worker/sw-bridge-protocol';

import { IS_SERVICE_WORKER_SUPPORTED } from '../../consts';
import type { FocusMessagePayload } from '@telegenie/libs/types/leader-tab.api';
import type GlobalStore from '../../store/global/global.store';
import { LeaderTab } from './leader-tab';

export type SwControllerOptions = {
  globalStore: GlobalStore;
  /** This tab's id (same as TabLeaderElection.tabId). Required for leader checks. */
  getTabId: () => string;
  showNotification?: (notification: { title: string; message: string }) => void;
  onFocusMessage?: (payload: FocusMessagePayload) => void;
};

/**
 * Service Worker registration + leader-only SW bridges (worker-rpc).
 *
 * Only the elected leader tab hosts {@link LeaderTabApi} (via {@link LeaderTab})
 * and brokers MessageChannels to the SW / Telegram SharedWorker.
 */
@Controller
export class SwController {
  private readonly globalStore: GlobalStore;
  private readonly getTabId: () => string;
  private readonly showNotificationCallback?: (notification: {
    title: string;
    message: string;
  }) => void;
  private readonly onFocusMessage?: (payload: FocusMessagePayload) => void;

  private readonly leaderTab: LeaderTab;
  private unwatchControllerChange: (() => void) | undefined;
  private unwatchBridgeRequest: (() => void) | undefined;

  constructor({ globalStore, getTabId, showNotification, onFocusMessage }: SwControllerOptions) {
    this.globalStore = globalStore;
    this.getTabId = getTabId;
    this.showNotificationCallback = showNotification;
    this.onFocusMessage = onFocusMessage;
    this.leaderTab = new LeaderTab({
      isLeader: () => this.isLeader,
      onFocusMessage,
    });
  }

  get isLeader(): boolean {
    return this.globalStore.leader.isLeader(this.getTabId());
  }

  /** Register `/sw.js` (all tabs). */
  @RequestLog()
  @Method()
  init(): void {
    void this.registerServiceWorker();
  }

  /**
   * Leader only: connect SW↔Telegram and SW↔leader bridges so the Service Worker
   * can invoke {@link LeaderTabApi} (sound / focus) on this tab.
   */
  @RequestLog()
  @Method()
  async connectLeaderBridges(telegramWorker: TelegramWorkerClient): Promise<void> {
    if (!this.isLeader) {
      return;
    }
    await this.leaderTab.connect(telegramWorker);
  }

  /** Leader only: re-bridge when the controlling SW changes. */
  @RequestLog()
  @Method()
  watchControllerChange(onChange: () => void): void {
    if (!this.isLeader) {
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
      return;
    }
    this.unwatchControllerChange?.();
    const handler = () => {
      if (!this.isLeader) return;
      onChange();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handler);
    this.unwatchControllerChange = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handler);
    };
  }

  /** Leader only: re-bridge when a restarted SW asks controlled tabs for fresh ports. */
  @RequestLog()
  @Method()
  watchBridgeRequest(onRequest: () => void): void {
    if (!this.isLeader) {
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
      return;
    }
    this.unwatchBridgeRequest?.();
    const handler = (event: MessageEvent) => {
      if (!this.isLeader) return;
      const data = event.data as BridgeMessage | null | undefined;
      if (data && typeof data === 'object' && data.kind === BRIDGE_KIND_REQUEST) {
        onRequest();
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    this.unwatchBridgeRequest = () => {
      navigator.serviceWorker.removeEventListener('message', handler);
    };
  }

  @RequestLog()
  @Method()
  disconnectLeaderBridges(): void {
    this.unwatchControllerChange?.();
    this.unwatchControllerChange = undefined;
    this.unwatchBridgeRequest?.();
    this.unwatchBridgeRequest = undefined;
    this.leaderTab.disconnect();
  }

  /** SW `showNotification` needs a Window-granted permission; prompt on gesture. */
  private requestNotificationPermissionOnGesture = (): void => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;

    const onGesture = () => {
      if (Notification.permission !== 'default') return;
      void Notification.requestPermission().catch(() => {
        // Prompt blocked or unsupported; SW skips OS notifications.
      });
    };
    window.addEventListener('pointerdown', onGesture, { once: true });
  };

  private notify = (title: string, message: string): void => {
    if (this.showNotificationCallback) {
      this.showNotificationCallback({ title, message });
    } else {
      console.warn(`[SW] ${title}: ${message}`);
    }
  };

  private registerServiceWorker = async (): Promise<void> => {
    if (!IS_SERVICE_WORKER_SUPPORTED) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        // `ready` means a worker is active. `controller` is set only after it
        // claims this document, which lands on `controllerchange`.
        if (navigator.serviceWorker.controller) {
          console.log('[SW] ServiceWorker ready');
        } else {
          navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => {
              console.log('[SW] ServiceWorker ready');
            },
            { once: true },
          );
        }

        this.requestNotificationPermissionOnGesture();
      } catch (err) {
        console.error('[SW] ServiceWorker registration failed: ', err);
        this.notify('Service Worker', 'Registration failed');
      }
    };

    if (document.readyState === 'complete') {
      void register();
    } else {
      window.addEventListener('load', () => void register());
    }
  };
}
