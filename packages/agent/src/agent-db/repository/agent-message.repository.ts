import { v4 as uuidv4 } from 'uuid';
import { AGENT_STORE } from '../agent-db.constants';
import type { AgentMessage, AgentMessageRole } from '../agent-db.types';
import type { AgentDb } from '../agent-db';

export class AgentMessageRepository {
  constructor(private readonly db: AgentDb) {}

  async findByRunId(runId: string): Promise<AgentMessage[]> {
    const messages = await this.db.getAllByIndex<AgentMessage>(
      AGENT_STORE.agentMessages,
      'byRunId',
      runId,
    );
    return messages.sort((a, b) => a.createdAt - b.createdAt);
  }

  async insert(
    runId: string,
    role: AgentMessageRole,
    content: string,
    thought?: string,
  ): Promise<AgentMessage> {
    const message: AgentMessage = {
      id: `msg_${uuidv4()}`,
      runId,
      role,
      content,
      thought,
      createdAt: Date.now(),
    };
    await this.db.put<AgentMessage>(AGENT_STORE.agentMessages, message);
    return message;
  }

  /** Delete orphaned messages whose runId is no longer in validRunIds. */
  async deleteOrphaned(validRunIds: Set<string>): Promise<void> {
    const all = await this.db.getAll<AgentMessage>(AGENT_STORE.agentMessages);
    const orphanIds = all.filter((m) => !validRunIds.has(m.runId)).map((m) => m.id);
    if (orphanIds.length > 0) {
      await this.db.deleteMany(AGENT_STORE.agentMessages, orphanIds);
    }
  }
}
