import { createWorkerClient, type WorkerClient, type WorkerLike } from '../../worker-rpc';
import type { TelegramWorkerApi, TelegramWorkerEvents } from './telegram.api';

export type TelegramWorkerClient = WorkerClient<TelegramWorkerApi, TelegramWorkerEvents>;

export type CreateTelegramWorkerClientOptions = {
  /**
   * Factory that returns a WorkerLike transport (DedicatedWorker, SharedWorker port, or FakePort).
   * Prefer {@link createDefaultTelegramWorker} in browser bundles.
   */
  createWorker?: () => WorkerLike;
};

/**
 * Build a typed flat RPC client over a Telegram worker transport.
 *
 * Prefer {@link createDefaultTelegramWorker} in browser bundles so the
 * `new URL(..., import.meta.url)` pattern is statically analyzable by Turbopack.
 */
export function createTelegramWorkerClient(
  options: CreateTelegramWorkerClientOptions,
): TelegramWorkerClient {
  if (!options.createWorker) {
    throw new Error(
      'createTelegramWorkerClient requires createWorker (use createDefaultTelegramWorker in the browser)',
    );
  }
  const worker = options.createWorker();
  worker.start?.();
  return createWorkerClient<TelegramWorkerApi, TelegramWorkerEvents>(worker);
}
