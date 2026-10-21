import {
  createWorkerClient,
  type WorkerClient,
  type WorkerLike,
} from '@telegenie/libs/foundation/worker-rpc';
import type { AgentWorkerApi, AgentWorkerEvents } from './agent.api';

export type AgentWorkerClient = WorkerClient<AgentWorkerApi, AgentWorkerEvents>;

export type CreateAgentWorkerClientOptions = {
  createWorker?: () => WorkerLike;
};

export function createAgentWorkerClient(
  options: CreateAgentWorkerClientOptions,
): AgentWorkerClient {
  if (!options.createWorker) {
    throw new Error(
      'createAgentWorkerClient requires createWorker (use createDefaultAgentWorker in the browser)',
    );
  }
  return createWorkerClient<AgentWorkerApi, AgentWorkerEvents>(options.createWorker());
}
