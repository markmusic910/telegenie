import generateUniqueId from '../../utils/generateUniqueId';
import {
  DEFAULT_BROADCAST_CHANNEL_NAME,
  type BroadcastEnvelope,
  type BroadcastHandler,
} from './types';

export type BroadcastBusOptions = {
  /** Override channel name. Defaults to {@link DEFAULT_BROADCAST_CHANNEL_NAME}. */
  name?: string;
  /** Stable id for this bus instance (used to ignore own echoes). */
  senderId?: string;
};

/**
 * Typed wrapper around `BroadcastChannel` for cross-tab / cross-worker messaging.
 * Own posts are filtered out via {@link BroadcastBus.senderId}.
 */
export class BroadcastBus {
  readonly name: string;
  readonly senderId: string;

  private readonly channel: BroadcastChannel;
  private readonly handlers = new Map<string, Set<BroadcastHandler>>();
  private readonly anyHandlers = new Set<BroadcastHandler>();
  private closed = false;

  constructor(options: BroadcastBusOptions = {}) {
    if (typeof BroadcastChannel === 'undefined') {
      throw new Error('BroadcastBus requires BroadcastChannel');
    }
    this.name = options.name ?? DEFAULT_BROADCAST_CHANNEL_NAME;
    this.senderId = options.senderId ?? generateUniqueId();
    this.channel = new BroadcastChannel(this.name);
    this.channel.addEventListener('message', this.onMessage);
  }

  post<T = unknown>(type: string, payload: T): void {
    this.assertOpen();
    const envelope: BroadcastEnvelope<T> = {
      type,
      payload,
      senderId: this.senderId,
      ts: Date.now(),
    };
    this.channel.postMessage(envelope);
  }

  on<T = unknown>(type: string, handler: BroadcastHandler<T>): () => void {
    this.assertOpen();
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler as BroadcastHandler);
    this.handlers.set(type, set);
    return () => {
      set.delete(handler as BroadcastHandler);
      if (set.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  /** Listen to every message type (still skips own echoes). */
  onAny<T = unknown>(handler: BroadcastHandler<T>): () => void {
    this.assertOpen();
    this.anyHandlers.add(handler as BroadcastHandler);
    return () => {
      this.anyHandlers.delete(handler as BroadcastHandler);
    };
  }

  once<T = unknown>(type: string, handler: BroadcastHandler<T>): () => void {
    const off = this.on<T>(type, (envelope) => {
      off();
      handler(envelope);
    });
    return off;
  }

  off(type: string, handler: BroadcastHandler): void {
    const set = this.handlers.get(type);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      this.handlers.delete(type);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.channel.removeEventListener('message', this.onMessage);
    this.channel.close();
    this.handlers.clear();
    this.anyHandlers.clear();
  }

  private readonly onMessage = (ev: MessageEvent<BroadcastEnvelope>) => {
    const envelope = ev.data;
    if (!envelope || typeof envelope !== 'object' || typeof envelope.type !== 'string') {
      return;
    }
    if (envelope.senderId === this.senderId) {
      return;
    }
    const typed = this.handlers.get(envelope.type);
    if (typed) {
      for (const handler of typed) {
        try {
          handler(envelope);
        } catch (err) {
          console.error('[BroadcastBus] handler error', err);
        }
      }
    }
    for (const handler of this.anyHandlers) {
      try {
        handler(envelope);
      } catch (err) {
        console.error('[BroadcastBus] onAny handler error', err);
      }
    }
  };

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('BroadcastBus is closed');
    }
  }
}

export function createBroadcastBus(options?: BroadcastBusOptions): BroadcastBus {
  return new BroadcastBus(options);
}
