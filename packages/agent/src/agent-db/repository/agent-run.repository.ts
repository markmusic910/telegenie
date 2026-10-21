import { v4 as uuidv4 } from 'uuid';
import { AGENT_STORE } from '../agent-db.constants';
import type { AgentRun, AgentRunStatus } from '../agent-db.types';
import type { AgentDb } from '../agent-db';

export class AgentRunRepository {
  constructor(private readonly db: AgentDb) {}

  async findById(id: string): Promise<AgentRun | undefined> {
    return this.db.get<AgentRun>(AGENT_STORE.agentRuns, id);
  }

  async findAll(): Promise<AgentRun[]> {
    return this.db.getAll<AgentRun>(AGENT_STORE.agentRuns);
  }

  async create(userMessage: string): Promise<AgentRun> {
    const run: AgentRun = {
      id: `run_${uuidv4()}`,
      userMessage,
      status: 'RUNNING',
      startedAt: Date.now(),
    };
    await this.db.put<AgentRun>(AGENT_STORE.agentRuns, run);
    return run;
  }

  async updateStatus(
    id: string,
    status: AgentRunStatus,
    error?: string,
  ): Promise<void> {
    const run = await this.findById(id);
    if (!run) return;
    await this.db.put<AgentRun>(AGENT_STORE.agentRuns, {
      ...run,
      status,
      completedAt: status !== 'RUNNING' ? Date.now() : run.completedAt,
      error,
    });
  }

  /** Delete runs older than the given timestamp. Returns deleted ids. */
  async deleteOlderThan(beforeMs: number): Promise<string[]> {
    const all = await this.findAll();
    const staleIds = all.filter((r) => r.startedAt < beforeMs).map((r) => r.id);
    if (staleIds.length > 0) {
      await this.db.deleteMany(AGENT_STORE.agentRuns, staleIds);
    }
    return staleIds;
  }
}
