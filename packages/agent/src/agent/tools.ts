import { tool, type StructuredToolInterface } from '@langchain/core/tools';
import type {
  TabPageToolContext,
  TabPageToolDescriptor,
  TabPageToolScope,
} from '@telegenie/libs/types/tab-page.api';
import { z } from 'zod';
import type { DialogMemorySync } from '../agent-db/agent-db.types';
import type { DialogMemorySyncRepository } from '../agent-db/repository/dialog-memory-sync.repository';
import { getWorkerState } from '../worker/agent-worker-init';
import { getTabPageClient, hasTabPageClient } from '../worker/tab-page-client';

export const BUILTIN_TOOL_GET_DIALOG_MEMORY_SYNC = 'get_dialog_memory_sync';

export type FormattedDialogMemorySync = DialogMemorySync & {
  lastSyncAtIso?: string;
  fromDateIso?: string;
  toDateIso?: string;
};

function toIsoIfPositive(ms?: number): string | undefined {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return undefined;
  return new Date(ms).toISOString();
}

function formatSyncRecord(record: DialogMemorySync): FormattedDialogMemorySync {
  return {
    ...record,
    lastSyncAtIso: toIsoIfPositive(record.lastSyncAt),
    fromDateIso: toIsoIfPositive(record.fromDate),
    toDateIso: toIsoIfPositive(record.toDate),
  };
}

const getDialogMemorySyncSchema = z.object({
  peerId: z
    .string()
    .optional()
    .describe(
      'Optional Telegram dialog peerId (e.g. "12345678" or "-1001234567890"). Omit to list all dialog memory sync records.',
    ),
  status: z
    .enum(['idle', 'syncing', 'completed', 'failed'])
    .optional()
    .describe('Optional status filter when listing all dialog memory sync records.'),
});

/**
 * Built-in worker tool that reads the `dialog_memory_syncs` table from AgentDb.
 */
export function createGetDialogMemorySyncTool(
  dialogMemorySyncRepo: DialogMemorySyncRepository,
): StructuredToolInterface {
  return tool(
    async ({ peerId, status }) => {
      if (peerId && peerId.trim().length > 0) {
        const record = await dialogMemorySyncRepo.findByPeerId(peerId.trim());
        return JSON.stringify({
          found: Boolean(record),
          record: record ? formatSyncRecord(record) : null,
        });
      }

      const all = await dialogMemorySyncRepo.findAll();
      const filtered = status ? all.filter((r) => r.status === status) : all;
      return JSON.stringify({
        count: filtered.length,
        records: filtered.map(formatSyncRecord),
      });
    },
    {
      name: BUILTIN_TOOL_GET_DIALOG_MEMORY_SYNC,
      description:
        'Read the agent-db dialog_memory_syncs IndexedDB table to check which Telegram dialogs have memory synced, their sync status, synced message counts, incremental sync setting, and synced date spans. Pass peerId for a single dialog, or omit peerId to list all records (optionally filtered by status).',
      schema: getDialogMemorySyncSchema,
    },
  );
}

/**
 * Wraps a tab-registered tool descriptor into a LangChain tool that delegates execution
 * back to the hosting tab page over `TabPageApi.invokeTool`.
 */
export function createTabProxyTool(
  descriptor: TabPageToolDescriptor,
  context: TabPageToolContext,
): StructuredToolInterface {
  const schema =
    descriptor.parameters && typeof descriptor.parameters === 'object'
      ? descriptor.parameters
      : { type: 'object', properties: {} };

  return tool(
    async (args: Record<string, unknown>) => {
      if (!hasTabPageClient()) {
        return JSON.stringify({
          error: `Tab page bridge is not connected; cannot execute tool "${descriptor.name}".`,
        });
      }

      try {
        const response = await getTabPageClient().call('invokeTool', [
          descriptor.name,
          args ?? {},
          context,
        ]);

        if (!response.ok) {
          return JSON.stringify({ error: response.error || `Tool "${descriptor.name}" failed.` });
        }

        return typeof response.result === 'string'
          ? response.result
          : JSON.stringify(response.result ?? { ok: true });
      } catch (err) {
        return JSON.stringify({
          error: (err as Error)?.message || `Tool "${descriptor.name}" threw an unexpected error.`,
        });
      }
    },
    {
      name: descriptor.name,
      description: descriptor.description,
      schema: schema as Record<string, unknown>,
    },
  );
}

export type ResolvedAgentTools = {
  tools: StructuredToolInterface[];
  toolsByName: Map<string, StructuredToolInterface>;
};

export type ResolveAgentToolsOptions = {
  context: TabPageToolContext;
  scope?: Exclude<TabPageToolScope, 'all'>;
  /** Optional explicit overrides for unit testing without initializing full worker state. */
  dialogMemorySyncRepo?: DialogMemorySyncRepository;
  tabTools?: TabPageToolDescriptor[];
};

function matchesScope(
  toolScope: TabPageToolScope | undefined,
  targetScope: Exclude<TabPageToolScope, 'all'>,
): boolean {
  const normalized: TabPageToolScope = toolScope ?? 'chat';
  return normalized === 'all' || normalized === targetScope;
}

/**
 * Resolve all tools available for a given execution scope (`'chat'` or `'composer'`).
 * Built-in worker tools take precedence over tab-registered tools on name collisions.
 */
export function resolveAgentTools({
  context,
  scope = 'chat',
  dialogMemorySyncRepo,
  tabTools,
}: ResolveAgentToolsOptions): ResolvedAgentTools {
  let resolvedSyncRepo = dialogMemorySyncRepo;
  let resolvedTabTools = tabTools;

  if (!resolvedSyncRepo || !resolvedTabTools) {
    try {
      const state = getWorkerState();
      resolvedSyncRepo ??= state.dialogMemorySyncRepo;
      resolvedTabTools ??= state.tabTools;
    } catch {
      // Worker state not initialized (e.g. standalone unit tests)
      resolvedTabTools ??= [];
    }
  }

  const toolsByName = new Map<string, StructuredToolInterface>();

  // 1. Built-in worker tools (chat scope)
  if (scope === 'chat' && resolvedSyncRepo) {
    const syncTool = createGetDialogMemorySyncTool(resolvedSyncRepo);
    toolsByName.set(syncTool.name, syncTool);
  }

  // 2. Tab-registered tools matching the active scope
  for (const descriptor of resolvedTabTools ?? []) {
    if (!descriptor?.name || !matchesScope(descriptor.scope, scope)) continue;
    if (toolsByName.has(descriptor.name)) {
      console.warn(
        `[AgentTools] Ignoring tab tool "${descriptor.name}" because a built-in or earlier tool with the same name already exists.`,
      );
      continue;
    }
    toolsByName.set(descriptor.name, createTabProxyTool(descriptor, context));
  }

  return {
    tools: Array.from(toolsByName.values()),
    toolsByName,
  };
}

/** Legacy empty static export kept for compatibility. Prefer `resolveAgentTools()`. */
export const tools: StructuredToolInterface[] = [];
