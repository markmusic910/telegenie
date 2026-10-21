// TODO: WIP: NotificationManager — revisit later (SharedWorker-driven alerts, leader sound, click deep-link).

import type { MessageNotificationPayload } from '@telegenie/libs/foundation/telegram/worker';
import type { WorkerClient } from '@telegenie/libs/foundation/worker-rpc';
import type { FocusMessagePayload, LeaderTabApi } from '@telegenie/libs/types/leader-tab.api';

import { APP_NAME, DEBUG, NOTIFICATION_ICON } from './constants';

declare const self: ServiceWorkerGlobalScope;

export type NotificationData = {
  messageId?: number;
  chatId?: string;
  title: string;
  body: string;
  isSilent?: boolean;
  icon?: string;
  reaction?: string;
  shouldReplaceHistory?: boolean;
};

export type NotificationManagerOptions = {
  getLeaderRpc: () => WorkerClient<LeaderTabApi> | undefined;
};

/**
 * OS notification show/click helpers for the Service Worker.
 * Driven by Telegram SharedWorker `messageNotification` events (not Web Push).
 * Sound + click deep-link go only to the leader tab via {@link LeaderTabApi}.
 */
export class NotificationManager {
  private lastSyncAt = Date.now();
  private readonly getLeaderRpc: NotificationManagerOptions['getLeaderRpc'];

  constructor(options: NotificationManagerOptions) {
    this.getLeaderRpc = options.getLeaderRpc;
  }

  init(): void {
    self.addEventListener('notificationclick', (e) => this.handleNotificationClick(e));
    self.addEventListener('sync', () => {
      this.lastSyncAt = Date.now();
    });
  }

  async onTelegramMessageNotification(payload: MessageNotificationPayload): Promise<void> {
    try {
      if (await this.hasFocusedClient()) {
        console.log('hasFocusedClient skip notification');
        return;
      }

      await this.showNotification({
        chatId: payload.chatId,
        messageId: payload.messageId,
        title: payload.title || APP_NAME,
        body: payload.body,
        isSilent: payload.isSilent,
        reaction: payload.reaction,
      });
    } catch (error) {
      if (DEBUG) {
        console.warn('[SW] onTelegramMessageNotification failed', error);
      }
    }
  }

  private async hasFocusedClient(): Promise<boolean> {
    const clients = await this.getClients();
    return clients.some((client) => client.focused);
  }

  private async getClients(): Promise<WindowClient[]> {
    const appUrl = new URL(self.registration.scope).origin;
    const clients = (await self.clients.matchAll({ type: 'window' })) as WindowClient[];
    return clients.filter((client) => new URL(client.url).origin === appUrl);
  }

  /** Resolve notification assets against the SW scope so Chromium gets an absolute URL. */
  private assetUrl(path: string): string {
    return new URL(path, self.registration.scope).href;
  }

  private async playNotificationSound(id: string): Promise<void> {
    const leaderRpc = this.getLeaderRpc();
    if (!leaderRpc) return;
    try {
      await leaderRpc.call('playNotificationSound', [id]);
    } catch (error) {
      if (DEBUG) {
        console.warn('[SW] playNotificationSound failed', error);
      }
    }
  }

  private async showNotification({
    chatId,
    messageId,
    body,
    title,
    icon,
    reaction,
    isSilent,
    shouldReplaceHistory,
  }: NotificationData): Promise<void> {
    const soundPromise =
      !reaction && !isSilent
        ? this.playNotificationSound(String(messageId ?? chatId ?? ''))
        : undefined;

    // SW cannot prompt; `showNotification` throws unless the page already granted.
    let permission: NotificationPermission | undefined;
    try {
      permission = typeof Notification !== 'undefined' ? Notification.permission : undefined;
    } catch {
      permission = undefined;
    }
    if (permission != null && permission !== 'granted') {
      await soundPromise;
      return;
    }

    const isFirstBatch = Date.now() - this.lastSyncAt < 1000;
    const tag = String(isFirstBatch ? 0 : chatId || 0);
    const iconUrl = this.assetUrl(icon || NOTIFICATION_ICON);
    const options: NotificationOptions = {
      body,
      data: {
        chatId,
        messageId,
        reaction,
        count: 1,
        shouldReplaceHistory,
      },
      icon: iconUrl,
      badge: iconUrl,
      tag,
      // @ts-expect-error vibrate is non-standard but widely supported
      vibrate: [200, 100, 200],
    };

    try {
      await Promise.all([soundPromise, self.registration.showNotification(title, options)]);
    } catch (error) {
      if (DEBUG) {
        console.warn('[SW] showNotification failed', error);
      }
    }
  }

  /** Ask the leader tab only to focus / deep-link (via sw-leader bridge). */
  private async focusLeaderMessage(data: FocusMessagePayload): Promise<boolean> {
    const leaderRpc = this.getLeaderRpc();
    if (!leaderRpc || !data.chatId) {
      return false;
    }
    try {
      await leaderRpc.call('focusMessage', [data]);
      return true;
    } catch (error) {
      if (DEBUG) {
        console.warn('[SW] focusMessage (leader) failed', error);
      }
      return false;
    }
  }

  private handleNotificationClick(e: NotificationEvent): void {
    const appUrl = self.registration.scope;
    e.notification.close();
    const data = (e.notification.data ?? {}) as FocusMessagePayload;
    e.waitUntil(
      (async () => {
        const focusedLeader = await this.focusLeaderMessage(data);
        if (focusedLeader) {
          return;
        }
        if (!self.clients.openWindow) return;
        const clients = await this.getClients();
        if (clients.length > 0) return;
        try {
          await self.clients.openWindow(appUrl);
        } catch (error) {
          if (DEBUG) {
            console.warn('[SW] ', error);
          }
        }
      })(),
    );
  }
}
