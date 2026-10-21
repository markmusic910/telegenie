import { createTelegramWorkerClient, type TelegramWorkerClient } from './create-telegram-worker-client';

/**
 * Browser/Turbopack entry: static `new URL(..., import.meta.url)` so the bundler
 * emits a SharedWorker chunk shared across tabs.
 *
 * Uses `.js` so prebuilt `dist/` consumers (Next without transpilePackages) resolve
 * the sibling worker entry beside this module.
 */
export function createDefaultTelegramWorker(): TelegramWorkerClient {
  if (typeof SharedWorker === 'undefined') {
    throw new Error('createDefaultTelegramWorker requires a browser SharedWorker environment');
  }
  return createTelegramWorkerClient({
    createWorker: () => {
      const shared = new SharedWorker(new URL('./telegram.worker.js', import.meta.url), {
        type: 'module',
        name: 'telegenie-telegram',
      });
      shared.port.start();
      return shared.port;
    },
  });
}
