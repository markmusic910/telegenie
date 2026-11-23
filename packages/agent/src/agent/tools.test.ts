import type { TabPageToolDescriptor } from '@telegenie/libs/types/tab-page.api';
import type { DialogMemorySync } from '../agent-db/agent-db.types';
import type { DialogMemorySyncRepository } from '../agent-db/repository/dialog-memory-sync.repository';
import {
  BUILTIN_TOOL_GET_DIALOG_MEMORY_SYNC,
  createGetDialogMemorySyncTool,
  createTabProxyTool,
  resolveAgentTools,
} from './tools';

jest.mock('../worker/tab-page-client', () => ({
  hasTabPageClient: jest.fn(),
  getTabPageClient: jest.fn(),
}));

import { getTabPageClient, hasTabPageClient } from '../worker/tab-page-client';

const mockedHasTabPageClient = hasTabPageClient as jest.MockedFunction<typeof hasTabPageClient>;
const mockedGetTabPageClient = getTabPageClient as jest.MockedFunction<typeof getTabPageClient>;

describe('createGetDialogMemorySyncTool', () => {
  const sampleRecords: DialogMemorySync[] = [
    {
      peerId: '100',
      lastSyncAt: 1_700_000_000_000,
      fromDate: 1_699_000_000_000,
      toDate: 1_700_000_000_000,
      syncedMessageCount: 42,
      incrementalSync: true,
      status: 'completed',
      createdAt: 1_699_000_000_000,
      updatedAt: 1_700_000_000_000,
    },
    {
      peerId: '-100200',
      lastSyncAt: 1_698_000_000_000,
      syncedMessageCount: 10,
      incrementalSync: false,
      status: 'failed',
      error: 'rate limit',
      createdAt: 1_698_000_000_000,
      updatedAt: 1_698_000_000_000,
    },
  ];

  const fakeRepo = {
    findByPeerId: jest.fn(async (peerId: string) =>
      sampleRecords.find((r) => r.peerId === peerId),
    ),
    findAll: jest.fn(async () => sampleRecords),
  } as unknown as DialogMemorySyncRepository;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches a single dialog record when peerId is provided', async () => {
    const syncTool = createGetDialogMemorySyncTool(fakeRepo);
    const raw = await syncTool.invoke({ peerId: '100' });
    const parsed = JSON.parse(String(raw));

    expect(fakeRepo.findByPeerId).toHaveBeenCalledWith('100');
    expect(parsed.found).toBe(true);
    expect(parsed.record.peerId).toBe('100');
    expect(parsed.record.syncedMessageCount).toBe(42);
    expect(parsed.record.lastSyncAtIso).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it('returns found: false when peerId has no record', async () => {
    const syncTool = createGetDialogMemorySyncTool(fakeRepo);
    const raw = await syncTool.invoke({ peerId: '999' });
    const parsed = JSON.parse(String(raw));

    expect(parsed).toEqual({ found: false, record: null });
  });

  it('lists all records when peerId is omitted and filters by status', async () => {
    const syncTool = createGetDialogMemorySyncTool(fakeRepo);

    const allRaw = await syncTool.invoke({});
    const allParsed = JSON.parse(String(allRaw));
    expect(allParsed.count).toBe(2);
    expect(allParsed.records).toHaveLength(2);

    const failedRaw = await syncTool.invoke({ status: 'failed' });
    const failedParsed = JSON.parse(String(failedRaw));
    expect(failedParsed.count).toBe(1);
    expect(failedParsed.records[0].peerId).toBe('-100200');
  });
});

describe('createTabProxyTool', () => {
  const descriptor: TabPageToolDescriptor = {
    name: 'custom_tab_tool',
    description: 'Runs on tab',
    parameters: {
      type: 'object',
      properties: { value: { type: 'string' } },
      required: ['value'],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards invocation to TabPageApi.invokeTool and returns serialized result', async () => {
    const call = jest.fn().mockResolvedValue({ ok: true, result: { echoed: 'hello' } });
    mockedHasTabPageClient.mockReturnValue(true);
    mockedGetTabPageClient.mockReturnValue({ call } as never);

    const proxyTool = createTabProxyTool(descriptor, { runId: 'run-1', peerId: '42' });
    const raw = await proxyTool.invoke({ value: 'hello' });

    expect(call).toHaveBeenCalledWith('invokeTool', [
      'custom_tab_tool',
      { value: 'hello' },
      { runId: 'run-1', peerId: '42' },
    ]);
    expect(JSON.parse(String(raw))).toEqual({ echoed: 'hello' });
  });

  it('returns structured error JSON when tab bridge is disconnected', async () => {
    mockedHasTabPageClient.mockReturnValue(false);

    const proxyTool = createTabProxyTool(descriptor, { runId: 'run-1' });
    const raw = await proxyTool.invoke({ value: 'hello' });

    expect(JSON.parse(String(raw)).error).toContain('not connected');
  });
});

describe('resolveAgentTools', () => {
  const fakeRepo = {
    findByPeerId: jest.fn(),
    findAll: jest.fn(),
  } as unknown as DialogMemorySyncRepository;

  const tabTools: TabPageToolDescriptor[] = [
    {
      name: BUILTIN_TOOL_GET_DIALOG_MEMORY_SYNC,
      description: 'Duplicate name attempting override',
      parameters: { type: 'object', properties: {} },
      scope: 'chat',
    },
    {
      name: 'chat_only_tool',
      description: 'Chat tool',
      parameters: { type: 'object', properties: {} },
      scope: 'chat',
    },
    {
      name: 'suggest_input_completions',
      description: 'Composer tool',
      parameters: { type: 'object', properties: {} },
      scope: 'composer',
    },
    {
      name: 'shared_tool',
      description: 'Shared tool',
      parameters: { type: 'object', properties: {} },
      scope: 'all',
    },
  ];

  it('filters chat scope and keeps built-in precedence over duplicate tab tool names', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const resolved = resolveAgentTools({
      context: { runId: 'run-1' },
      scope: 'chat',
      dialogMemorySyncRepo: fakeRepo,
      tabTools,
    });
    warnSpy.mockRestore();

    const names = resolved.tools.map((t) => t.name);
    expect(names).toContain(BUILTIN_TOOL_GET_DIALOG_MEMORY_SYNC);
    expect(names).toContain('chat_only_tool');
    expect(names).toContain('shared_tool');
    expect(names).not.toContain('suggest_input_completions');
    expect(resolved.toolsByName.get(BUILTIN_TOOL_GET_DIALOG_MEMORY_SYNC)?.description).toContain(
      'dialog_memory_syncs',
    );
  });

  it('filters composer scope to composer + all tab tools only', () => {
    const resolved = resolveAgentTools({
      context: { runId: 'run-1' },
      scope: 'composer',
      dialogMemorySyncRepo: fakeRepo,
      tabTools,
    });

    const names = resolved.tools.map((t) => t.name);
    expect(names).toEqual(['suggest_input_completions', 'shared_tool']);
  });
});
