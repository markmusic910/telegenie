import { createWorkerClient, type WorkerClient } from '@telegenie/libs/foundation/worker-rpc';
import type { RLottieWorkerApi } from './rlottie.api';

export const RLOTTIE_WORKER_NAME_PREFIX = 'telegenie-rlottie';

/** Bundled module worker. `new URL` must stay a literal so Next emits the chunk. */
export function createRLottieWorkerClient(index: number): WorkerClient<RLottieWorkerApi> {
  const worker = new Worker(new URL('./rlottie.worker.ts', import.meta.url), {
    type: 'module',
    name: `${RLOTTIE_WORKER_NAME_PREFIX}:${index}`,
  });
  const client = createWorkerClient<RLottieWorkerApi>(worker);
  worker.addEventListener('error', () => {
    client.terminate();
  });
  return client;
}
