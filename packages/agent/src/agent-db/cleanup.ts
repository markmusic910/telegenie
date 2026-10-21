import { AGENT_RUN_TTL_DAYS, AGENT_STORE } from './agent-db.constants';
import type { AgentDb } from './agent-db';
import type { AgentRun } from './agent-db.types';

const TTL_MS = AGENT_RUN_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Purge stale agent execution records on worker startup.
 *
 * Strategy:
 * 1. Delete `agent_runs` older than AGENT_RUN_TTL_DAYS days.
 * 2. Cascade-delete orphaned `agent_messages`, `tool_calls`, `agent_checkpoints`
 *    whose `runId` no longer exists.
 *
 * Permanent data (`dialog_presets`) and Memory DB records are NEVER purged here.
 */
export async function cleanupAgentDb(db: AgentDb, now = Date.now()): Promise<void> {
  const cutoff = now - TTL_MS;

  // 1. Find runs to delete
  const allRuns = await db.getAll<AgentRun>(AGENT_STORE.agentRuns);
  const staleRunIds = allRuns
    .filter((run) => run.startedAt < cutoff)
    .map((run) => run.id);

  if (staleRunIds.length > 0) {
    await db.deleteMany(AGENT_STORE.agentRuns, staleRunIds);
  }

  // 2. Build the set of still-valid run ids
  const validRunIds = new Set(
    allRuns.filter((run) => run.startedAt >= cutoff).map((run) => run.id),
  );

  // 3. Cascade delete from child stores
  await cascadeDeleteOrphans(db, AGENT_STORE.agentMessages, 'byRunId', validRunIds);
  await cascadeDeleteOrphans(db, AGENT_STORE.toolCalls, 'byRunId', validRunIds);
  await cascadeDeleteOrphans(db, AGENT_STORE.agentCheckpoints, 'byRunId', validRunIds);
}

async function cascadeDeleteOrphans(
  db: AgentDb,
  store: string,
  runIdIndex: string,
  validRunIds: Set<string>,
): Promise<void> {
  const allRecords = await db.getAll<{ id: string; runId: string }>(store);
  const orphanIds = allRecords
    .filter((record) => !validRunIds.has(record.runId))
    .map((record) => record.id);

  if (orphanIds.length > 0) {
    await db.deleteMany(store, orphanIds);
  }
}
