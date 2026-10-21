import type { TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';

/** Minimal Worker RPC client stub for Jest (no real Worker). */
export function createMockTelegramWorkerClient(
  overrides: Partial<TelegramWorkerClient> = {},
): TelegramWorkerClient {
  return {
    call: jest.fn().mockResolvedValue(undefined),
    stream: async function* () {},
    on: jest.fn().mockReturnValue(() => {}),
    terminate: jest.fn(),
    worker: {
      postMessage: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      terminate: jest.fn(),
    },
    ...overrides,
  };
}
