'use client';

import type { WorkerClient } from '@telegenie/libs/foundation/worker-rpc';
import type { RLottieInitResult, RLottieWorkerApi } from '@/lib/rlottie/rlottie.api';

export type { RLottieInitResult } from '@/lib/rlottie/rlottie.api';

const LOW_PRIORITY_QUALITY = 0.75;
const MAX_WORKERS = 4;

export type RLottieTransport = {
  init(
    key: string,
    tgsUrl: string,
    imgSize: number,
    isLowPriority: boolean,
  ): Promise<RLottieInitResult | null>;
  render(key: string, frameIndex: number): Promise<ImageBitmap>;
  destroy(key: string): void;
};

type Renderer = {
  key: string;
  refs: number;
  bitmap: ImageBitmap | null;
  listeners: Set<() => void>;
  destroyed: boolean;
  started: boolean;
};

const renderers = new Map<string, Renderer>();
let transportOverride: RLottieTransport | undefined;
let defaultTransport: RLottieTransport | undefined;

export function customEmojiPixelSize(cssSize: number): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.max(1, Math.round(cssSize * Math.max(dpr * LOW_PRIORITY_QUALITY, 1)));
}

export function setRLottieTransportForTests(next: RLottieTransport | undefined): void {
  transportOverride = next;
}

export function resetCustomEmojiPlayersForTests(): void {
  for (const renderer of renderers.values()) renderer.destroyed = true;
  renderers.clear();
}

function getTransport(): RLottieTransport {
  if (transportOverride) return transportOverride;
  defaultTransport ??= createWorkerTransport();
  return defaultTransport;
}

function notify(renderer: Renderer): void {
  for (const listener of renderer.listeners) listener();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function waitUntilVisible(): Promise<void> {
  if (typeof document === 'undefined' || !document.hidden) return Promise.resolve();
  return new Promise((resolve) => {
    const onChange = () => {
      if (!document.hidden) {
        document.removeEventListener('visibilitychange', onChange);
        resolve();
      }
    };
    document.addEventListener('visibilitychange', onChange);
  });
}

async function run(renderer: Renderer, src: string, imgSize: number): Promise<void> {
  const transport = getTransport();
  try {
    const timing = await transport.init(renderer.key, src, imgSize, true);
    if (!timing || renderer.destroyed) {
      if (renderer.destroyed) transport.destroy(renderer.key);
      return;
    }
    let frame = 0;
    const framesCount = Math.max(1, timing.framesCount);

    while (!renderer.destroyed) {
      if (typeof document !== 'undefined' && document.hidden) {
        await waitUntilVisible();
        continue;
      }
      const started = performance.now();
      const bitmap = await transport.render(renderer.key, frame);
      if (renderer.destroyed) {
        bitmap.close?.();
        return;
      }
      const previous = renderer.bitmap;
      renderer.bitmap = bitmap;
      previous?.close?.();
      notify(renderer);
      frame = (frame + 1) % framesCount;
      const wait = timing.msPerFrame - (performance.now() - started);
      if (wait > 0) await sleep(wait);
    }
  } catch {
    // The placeholder thumb stays up when decode or render fails.
  }
}

export type RetainedCustomEmoji = {
  release: () => void;
  subscribe: (listener: () => void) => () => void;
  getBitmap: () => ImageBitmap | null;
};

export function retainCustomEmoji(options: {
  documentId: string;
  src: string;
  size: number;
}): RetainedCustomEmoji {
  const imgSize = customEmojiPixelSize(options.size);
  const key = `${options.documentId}:${imgSize}`;
  let renderer = renderers.get(key);
  if (!renderer) {
    renderer = {
      key,
      refs: 0,
      bitmap: null,
      listeners: new Set(),
      destroyed: false,
      started: false,
    };
    renderers.set(key, renderer);
  }
  const player = renderer;
  player.refs += 1;
  if (!player.started) {
    player.started = true;
    void run(player, options.src, imgSize);
  }

  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      player.refs -= 1;
      if (player.refs > 0) return;
      player.destroyed = true;
      player.bitmap?.close?.();
      player.bitmap = null;
      renderers.delete(key);
      getTransport().destroy(key);
      notify(player);
    },
    subscribe(listener) {
      player.listeners.add(listener);
      return () => {
        player.listeners.delete(listener);
      };
    },
    getBitmap: () => player.bitmap,
  };
}

function createWorkerTransport(): RLottieTransport {
  if (typeof window === 'undefined') {
    return {
      init: async () => {
        throw new Error('RLottie workers run in the browser');
      },
      render: async () => {
        throw new Error('RLottie workers run in the browser');
      },
      destroy() {},
    };
  }

  const cores = navigator.hardwareConcurrency || MAX_WORKERS;
  const workerCount = Math.min(Math.max(cores, 1), MAX_WORKERS);
  const slots: Array<WorkerClient<RLottieWorkerApi> | undefined> = Array.from({
    length: workerCount,
  });
  const pendingSlots: Array<Promise<WorkerClient<RLottieWorkerApi>> | undefined> = [];
  const keySlot = new Map<string, number>();
  let cursor = 0;

  function assign(key: string): number {
    const existing = keySlot.get(key);
    if (existing != null) return existing;
    const index = cursor % workerCount;
    cursor += 1;
    keySlot.set(key, index);
    return index;
  }

  function clientFor(index: number): Promise<WorkerClient<RLottieWorkerApi>> {
    const ready = slots[index];
    if (ready) return Promise.resolve(ready);
    const pending = pendingSlots[index];
    if (pending) return pending;
    // On demand so unit tests never construct a Worker. `new URL` stays in the client module.
    const created = import('./rlottie.worker.client').then(
      ({ createRLottieWorkerClient }) => {
        const client = createRLottieWorkerClient(index);
        slots[index] = client;
        return client;
      },
    );
    pendingSlots[index] = created;
    return created;
  }

  return {
    init(key, tgsUrl, imgSize, isLowPriority) {
      return clientFor(assign(key)).then((client) =>
        client.call('init', [key, tgsUrl, imgSize, isLowPriority]),
      );
    },
    render(key, frameIndex) {
      const index = keySlot.get(key);
      if (index == null) return Promise.reject(new Error(`Missing rlottie worker for ${key}`));
      return clientFor(index).then((client) => client.call('render', [key, frameIndex]));
    },
    destroy(key) {
      const index = keySlot.get(key);
      keySlot.delete(key);
      if (index == null) return;
      void clientFor(index)
        .then((client) => client.call('destroy', [key]))
        .catch(() => undefined);
    },
  };
}
