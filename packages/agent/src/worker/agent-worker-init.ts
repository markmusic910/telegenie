import { getTabId } from '@telegenie/decorators';
import type { TabPageToolDescriptor } from '@telegenie/libs/types/tab-page.api';
import { AgentDb } from '../agent-db/agent-db';
import { cleanupAgentDb } from '../agent-db/cleanup';
import type { GenieSkill } from '../agent-db/agent-db.types';
import { AgentMessageRepository } from '../agent-db/repository/agent-message.repository';
import { AgentRunRepository } from '../agent-db/repository/agent-run.repository';
import { DialogPresetRepository } from '../agent-db/repository/dialog-preset.repository';
import { ToolCallRepository } from '../agent-db/repository/tool-call.repository';
import { getGraph } from '../agent/graph';
import { createChatModel, setModelConfig, type ModelConfig } from '../agent/models';
import { initNodes } from '../agent/nodes';
import { MemoryDb } from '../memory/db/memory-db';
import { MemoryEngine } from '../memory/engine/memory-engine';
import { EntityRepository } from '../memory/repository/entity.repository';
import { MemorySourceRepository } from '../memory/repository/memory-source.repository';
import { MemoryRepository } from '../memory/repository/memory.repository';
import { DialogMemorySyncRepository } from '../agent-db/repository/dialog-memory-sync.repository';
import { Retriever } from '../runtime/retriever';

export type AgentWorkerState = {
  memoryDb: MemoryDb;
  agentDb: AgentDb;
  entityRepo: EntityRepository;
  memoryRepo: MemoryRepository;
  memorySourceRepo: MemorySourceRepository;
  dialogPresetRepo: DialogPresetRepository;
  dialogMemorySyncRepo: DialogMemorySyncRepository;
  agentRunRepo: AgentRunRepository;
  agentMessageRepo: AgentMessageRepository;
  toolCallRepo: ToolCallRepository;
  memoryEngine: MemoryEngine | undefined; // only initialized after configureModel
  retriever: Retriever;
  installedSkills: GenieSkill[];
  tabTools: TabPageToolDescriptor[];
  userIdentity?: string;
  accountSlot: string;
  tabId: string;
};

let _state: AgentWorkerState | undefined;

/**
 * Parse worker identity from self.name (formatted as `telegenie-agent:${accountSlot}:${tabId}`).
 */
export function parseWorkerName(): { accountSlot?: string; tabId?: string } {
  if (typeof self !== 'undefined' && typeof self.name === 'string') {
    const prefix = 'telegenie-agent:';
    if (self.name.startsWith(prefix)) {
      const [accountSlot, tabId] = self.name.slice(prefix.length).split(':');
      return {
        accountSlot: accountSlot || undefined,
        tabId: tabId || undefined,
      };
    }
  }
  return {};
}

/**
 * Extract accountSlot from self.name.
 */
export function resolveWorkerAccountSlot(): string | undefined {
  return parseWorkerName().accountSlot;
}

/**
 * Extract tabId from self.name.
 */
export function resolveWorkerTabId(): string | undefined {
  return parseWorkerName().tabId;
}

/**
 * Initialize all databases, repositories, and the retriever.
 * Called once on agent worker startup (before any RPC handlers run).
 * MemoryEngine requires the LLM model, so it is initialized lazily in configureModel.
 */
export async function initAgentWorker(
  explicitAccountSlot?: string,
  explicitTabId?: string,
): Promise<AgentWorkerState> {
  const accountSlot = explicitAccountSlot || resolveWorkerAccountSlot() || 'default';
  const tabId = explicitTabId || resolveWorkerTabId() || getTabId();

  // Grafeo MemoryDb is initialized lazily on first read/write to avoid WASM heap
  // allocation in idle follower tabs.
  const memoryDb = new MemoryDb({ accountSlot });

  const agentDb = new AgentDb({ accountSlot });
  await agentDb.open();

  // Cleanup stale agent runs on startup
  await cleanupAgentDb(agentDb);

  const entityRepo = new EntityRepository(memoryDb);
  const memoryRepo = new MemoryRepository(memoryDb);
  const memorySourceRepo = new MemorySourceRepository(memoryDb);
  const dialogPresetRepo = new DialogPresetRepository(agentDb);
  const dialogMemorySyncRepo = new DialogMemorySyncRepository(agentDb);
  const agentRunRepo = new AgentRunRepository(agentDb);
  const agentMessageRepo = new AgentMessageRepository(agentDb);
  const toolCallRepo = new ToolCallRepository(agentDb);

  const retriever = new Retriever({
    accountSlot,
    memoryRepository: memoryRepo,
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
    dialogPresetRepo,
    dialogMemorySyncRepo,
    agentRunRepo,
    agentMessageRepo,
    toolCallRepo,
    memoryEngine: undefined,
    retriever,
    installedSkills: [],
    tabTools: [],
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
  configOrApiKey: string | ModelConfig,
  model?: string,
): void {
  if (!_state) throw new Error('Worker not initialized');
  if (typeof configOrApiKey === 'string') {
    setModelConfig({ apiKey: configOrApiKey, model: model ?? 'gpt-4o' });
  } else {
    setModelConfig(configOrApiKey);
  }

  try {
    _state.memoryEngine = new MemoryEngine({
      createModel: (costSource?: string) =>
        createChatModel({ costSource: costSource ?? 'memory extraction' }),
      entityRepository: _state.entityRepo,
      memoryRepository: _state.memoryRepo,
      memorySourceRepository: _state.memorySourceRepo,
    });
  } catch (err) {
    console.warn('[AgentWorker] MemoryEngine initialization deferred (API key pending):', err);
  }
}

export function getWorkerState(): AgentWorkerState {
  if (!_state) throw new Error('Agent worker not initialized. Call initAgentWorker() first.');
  return _state;
}
