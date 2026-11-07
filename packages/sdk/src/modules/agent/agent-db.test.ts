import { AgentDb, AGENT_STORE, AGENT_RUN_TTL_DAYS, cleanupAgentDb } from '@telegenie/agent';
import type { AgentRun, AgentMessage, ToolCallRecord, DialogPreset } from '@telegenie/agent';

describe('AgentDb and Cleanup (accountSlot & 30-day TTL)', () => {
  const accountSlot = 'test-slot-1';
  let agentDb: AgentDb;

  beforeEach(async () => {
    agentDb = new AgentDb({ accountSlot });
    await agentDb.open();
  });

  afterEach(() => {
    agentDb.close();
  });

  it('configures 30-day TTL constant', () => {
    expect(AGENT_RUN_TTL_DAYS).toBe(30);
  });

  it('initializes AgentDb with accountSlot namespace', () => {
    // Check that internal IdbManager was initialized with telegenie-agent_${accountSlot}
    expect((agentDb as any).idb.name).toBe(`telegenie-agent_${accountSlot}`);
  });

  it('purges runs older than 30 days and cascades deletions while preserving dialog presets', async () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Create a 35-day-old run (should be deleted)
    const oldRun: AgentRun = {
      id: 'run-old',
      prompt: 'old prompt',
      startedAt: now - 35 * dayMs,
      completedAt: now - 35 * dayMs + 1000,
      status: 'COMPLETED',
    };

    // Create a 10-day-old run (should be kept)
    const recentRun: AgentRun = {
      id: 'run-recent',
      prompt: 'recent prompt',
      startedAt: now - 10 * dayMs,
      completedAt: now - 10 * dayMs + 1000,
      status: 'COMPLETED',
    };

    await agentDb.put(AGENT_STORE.agentRuns, oldRun);
    await agentDb.put(AGENT_STORE.agentRuns, recentRun);

    // Messages
    const oldMessage: AgentMessage = {
      id: 'msg-old',
      runId: 'run-old',
      role: 'USER',
      content: 'old message',
      createdAt: now - 35 * dayMs,
    };
    const recentMessage: AgentMessage = {
      id: 'msg-recent',
      runId: 'run-recent',
      role: 'USER',
      content: 'recent message',
      createdAt: now - 10 * dayMs,
    };

    await agentDb.put(AGENT_STORE.agentMessages, oldMessage);
    await agentDb.put(AGENT_STORE.agentMessages, recentMessage);

    // Tool calls
    const oldToolCall: ToolCallRecord = {
      id: 'tool-old',
      runId: 'run-old',
      name: 'search',
      args: '{}',
      startedAt: now - 35 * dayMs,
      status: 'SUCCESS',
    };
    const recentToolCall: ToolCallRecord = {
      id: 'tool-recent',
      runId: 'run-recent',
      name: 'search',
      args: '{}',
      startedAt: now - 10 * dayMs,
      status: 'SUCCESS',
    };

    await agentDb.put(AGENT_STORE.toolCalls, oldToolCall);
    await agentDb.put(AGENT_STORE.toolCalls, recentToolCall);

    // Dialog preset (should NEVER be deleted)
    const preset: DialogPreset = {
      peerId: 'peer-123',
      tone: 'Concise',
      customPrompt: 'Be brief',
      updatedAt: now - 50 * dayMs, // older than 30 days
    };
    await agentDb.put(AGENT_STORE.dialogPresets, preset);

    // Run cleanup
    await cleanupAgentDb(agentDb, now);

    // Verify runs
    const runs = await agentDb.getAll<AgentRun>(AGENT_STORE.agentRuns);
    expect(runs.map((r) => r.id)).toEqual(['run-recent']);

    // Verify messages cascaded
    const messages = await agentDb.getAll<AgentMessage>(AGENT_STORE.agentMessages);
    expect(messages.map((m) => m.id)).toEqual(['msg-recent']);

    // Verify tool calls cascaded
    const toolCalls = await agentDb.getAll<ToolCallRecord>(AGENT_STORE.toolCalls);
    expect(toolCalls.map((t) => t.id)).toEqual(['tool-recent']);

    // Verify dialog preset is preserved
    const presets = await agentDb.getAll<DialogPreset>(AGENT_STORE.dialogPresets);
    expect(presets).toHaveLength(1);
    expect(presets[0].peerId).toBe('peer-123');
  });
});
