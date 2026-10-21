import { v4 as uuidv4 } from 'uuid';
import { AGENT_STORE } from '../agent-db.constants';
import type { AgentCheckpoint, AgentPhase } from '../agent-db.types';
import type { AgentDb } from '../agent-db';

export class CheckpointRepository {
  constructor(private readonly db: AgentDb) {}

  async findByRunId(runId: string): Promise<AgentCheckpoint[]> {
    const checkpoints = await this.db.getAllByIndex<AgentCheckpoint>(
      AGENT_STORE.agentCheckpoints,
      'byRunId',
      runId,
    );
    return checkpoints.sort((a, b) => a.step - b.step);
  }

  async insert(
    runId: string,
    step: number,
    phase: AgentPhase,
    state: Record<string, unknown>,
  ): Promise<AgentCheckpoint> {
    const checkpoint: AgentCheckpoint = {
      id: `cp_${uuidv4()}`,
      runId,
      step,
      phase,
      state,
      createdAt: Date.now(),
    };
    await this.db.put<AgentCheckpoint>(AGENT_STORE.agentCheckpoints, checkpoint);
    return checkpoint;
  }

  /** Delete orphaned checkpoints whose runId is no longer in validRunIds. */
  async deleteOrphaned(validRunIds: Set<string>): Promise<void> {
    const all = await this.db.getAll<AgentCheckpoint>(AGENT_STORE.agentCheckpoints);
    const orphanIds = all.filter((cp) => !validRunIds.has(cp.runId)).map((cp) => cp.id);
    if (orphanIds.length > 0) {
      await this.db.deleteMany(AGENT_STORE.agentCheckpoints, orphanIds);
    }
  }
}
