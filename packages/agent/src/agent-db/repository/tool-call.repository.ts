import { v4 as uuidv4 } from 'uuid';
import { AGENT_STORE } from '../agent-db.constants';
import type { ToolCall, ToolCallStatus } from '../agent-db.types';
import type { AgentDb } from '../agent-db';

export class ToolCallRepository {
  constructor(private readonly db: AgentDb) {}

  async findById(id: string): Promise<ToolCall | undefined> {
    return this.db.get<ToolCall>(AGENT_STORE.toolCalls, id);
  }

  async findByRunId(runId: string): Promise<ToolCall[]> {
    return this.db.getAllByIndex<ToolCall>(AGENT_STORE.toolCalls, 'byRunId', runId);
  }

  async insert(
    runId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolCall> {
    const toolCall: ToolCall = {
      id: `tc_${uuidv4()}`,
      runId,
      toolName,
      arguments: args,
      status: 'PENDING',
      startedAt: Date.now(),
    };
    await this.db.put<ToolCall>(AGENT_STORE.toolCalls, toolCall);
    return toolCall;
  }

  async updateResult(
    id: string,
    status: ToolCallStatus,
    result?: unknown,
    error?: string,
  ): Promise<void> {
    const tc = await this.findById(id);
    if (!tc) return;
    await this.db.put<ToolCall>(AGENT_STORE.toolCalls, {
      ...tc,
      status,
      result,
      error,
      completedAt: Date.now(),
    });
  }

  /** Delete orphaned tool_calls whose runId is no longer in validRunIds. */
  async deleteOrphaned(validRunIds: Set<string>): Promise<void> {
    const all = await this.db.getAll<ToolCall>(AGENT_STORE.toolCalls);
    const orphanIds = all.filter((tc) => !validRunIds.has(tc.runId)).map((tc) => tc.id);
    if (orphanIds.length > 0) {
      await this.db.deleteMany(AGENT_STORE.toolCalls, orphanIds);
    }
  }
}
