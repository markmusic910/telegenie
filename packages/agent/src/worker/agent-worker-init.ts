import { getTabId } from '@telegenie/decorators';
import { MemoryDb } from '../memory/db/memory-db';
import { EntityRepository } from '../memory/repository/entity.repository';
import { MemoryRepository } from '../memory/repository/memory.repository';
import { MemorySourceRepository } from '../memory/repository/memory-source.repository';
import { CommitmentRepository } from '../memory/repository/commitment.repository';
import { EmbeddingRepository } from '../memory/repository/embedding.repository';
import { DialogPresetRepository } from '../agent-db/repository/dialog-preset.repository';
import { MemoryEngine } from '../memory/engine/memory-engine';
import { AgentDb } from '../agent-db/agent-db';
import { cleanupAgentDb } from '../agent-db/cleanup';
import { Retriever } from '../runtime/retriever';
import { initNodes } from '../agent/nodes';
import { getGraph } from '../agent/graph';
import { setModelConfig, createChatModel } from '../agent/models';

export type AgentWorkerState = {
  memoryDb: MemoryDb;
  agentDb: AgentDb;
  entityRepo: EntityRepository;
  memoryRepo: MemoryRepository;
  memorySourceRepo: MemorySourceRepository;
  commitmentRepo: CommitmentRepository;
  embeddingRepo: EmbeddingRepository;
  dialogPresetRepo: DialogPresetRepository;
  memoryEngine: MemoryEngine | undefined; // only initialized after configureModel
  retriever: Retriever;
  accountSlot: string;
  tabId: string;
};

let _state: AgentWorkerState | undefined;

/**
 * Extract tabId from self.name (passed via Worker constructor options.name).
 */
export function resolveWorkerTabId(): string | undefined {
  if (typeof self !== 'undefined' && typeof self.name === 'string') {
    const prefix = 'telegenie-agent:';
    if (self.name.startsWith(prefix)) {
      return self.name.slice(prefix.length);
    }
    if (self.name && self.name !== 'telegenie-agent') {
      return self.name;
    }
  }
  return undefined;
}

/**
 * Initialize all databases, repositories, and the retriever.
 * Called once on agent worker startup (before any RPC handlers run).
 * MemoryEngine requires the LLM model, so it is initialized lazily in configureModel.
 */
export async function initAgentWorker(
  accountSlot = 'default',
  explicitTabId?: string,
): Promise<AgentWorkerState> {
  const tabId = explicitTabId || resolveWorkerTabId() || getTabId();

  const memoryDb = new MemoryDb({ accountSlot });
  await memoryDb.open();

  const agentDb = new AgentDb({ tabId });
  await agentDb.open();

  // Cleanup stale agent runs on startup
  await cleanupAgentDb(agentDb);

  const entityRepo = new EntityRepository(memoryDb);
  const memoryRepo = new MemoryRepository(memoryDb);
  const memorySourceRepo = new MemorySourceRepository(memoryDb);
  const commitmentRepo = new CommitmentRepository(memoryDb);
  const embeddingRepo = new EmbeddingRepository(memoryDb);
  const dialogPresetRepo = new DialogPresetRepository(agentDb);

  const retriever = new Retriever({
    accountSlot,
    memoryRepository: memoryRepo,
    commitmentRepository: commitmentRepo,
    entityRepository: entityRepo,
    dialogPresetRepository: dialogPresetRepo,
  });

  // Wire retriever into graph nodes
  initNodes(retriever);

  // Initialize graph singleton (MemorySaver checkpointer)
  getGraph();

  _state = {
    memoryDb,
    agentDb,
    entityRepo,
    memoryRepo,
    memorySourceRepo,
    commitmentRepo,
    embeddingRepo,
    dialogPresetRepo,
    memoryEngine: undefined,
    retriever,
    accountSlot,
    tabId,
  };

  return _state;
}

/**
 * Configure the LLM model and initialize the MemoryEngine.
 * Must be called before processNewMessages or chat RPCs.
 */
export function configureAgentModel(
  apiKey: string,
  model: string,
): void {
  if (!_state) throw new Error('Worker not initialized');
  setModelConfig({ apiKey, model });

  _state.memoryEngine = new MemoryEngine({
    model: createChatModel(),
    entityRepository: _state.entityRepo,
    memoryRepository: _state.memoryRepo,
    memorySourceRepository: _state.memorySourceRepo,
    commitmentRepository: _state.commitmentRepo,
  });
}

export function getWorkerState(): AgentWorkerState {
  if (!_state) throw new Error('Agent worker not initialized. Call initAgentWorker() first.');
  return _state;
}
