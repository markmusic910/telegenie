import { AgentController } from './agent.controller';
import { TAB_MSG } from '@telegenie/libs/foundation/broadcast-channel';
import { GlobalStore } from '../../store/global/global.store';

const storage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, String(value)),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  get length() {
    return storage.size;
  },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

function createTestStore(credits: number = 100): GlobalStore {
  const store = new GlobalStore();
  store.auth.setBackendUserProfile({
    telegramId: '123',
    enableTracing: false,
    status: { isBlocked: false, createdAt: 0, lastActiveAt: 0 },
    credits: {
      dailyFreeLimit: 100,
      dailyFreeUsed: 0,
      dailyFreeRemaining: 100,
      paidCredits: 0,
      totalAvailable: credits,
      lastResetDate: '',
    },
  });
  return store;
}

describe('Agent Controller Memory Sync & Incremental Extraction', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('delegates getDialogMemorySync and getAllDialogMemorySyncs to worker', async () => {
    const mockWorkerClient = {
      call: jest.fn().mockImplementation((method: string, args: unknown[]) => {
        if (method === 'getDialogMemorySync') {
          return Promise.resolve({
            peerId: args[0],
            lastSyncAt: 12345,
            syncedMessageCount: 10,
            status: 'completed',
          });
        }
        if (method === 'getAllDialogMemorySyncs') {
          return Promise.resolve([
            { peerId: '100', lastSyncAt: 12345, syncedMessageCount: 10, status: 'completed' },
          ]);
        }
        return Promise.resolve();
      }),
      worker: {} as any,
    };

    const agent = new AgentController({
      createWorkerClient: () => mockWorkerClient as any,
    });

    const single = await agent.getDialogMemorySync('100');
    expect(single?.peerId).toBe('100');
    expect(single?.syncedMessageCount).toBe(10);

    const all = await agent.getAllDialogMemorySyncs();
    expect(all).toHaveLength(1);
    expect(all[0].peerId).toBe('100');
  });

  it('delegates setIncrementalMemorySync to worker', async () => {
    const mockWorkerClient = {
      call: jest.fn().mockResolvedValue({
        peerId: '100',
        incrementalSync: true,
        lastSyncAt: 0,
        syncedMessageCount: 0,
        status: 'idle',
      }),
      worker: {} as any,
    };

    const agent = new AgentController({
      createWorkerClient: () => mockWorkerClient as any,
    });

    const res = await agent.setIncrementalMemorySync('100', true);
    expect(mockWorkerClient.call).toHaveBeenCalledWith('setIncrementalMemorySync', ['100', true]);
    expect(res.incrementalSync).toBe(true);
  });

  it('evaluates hasCredit correctly based on selectedModel, BYOK keys, and backend credits', () => {
    const store = createTestStore(0);
    const agent = new AgentController({
      globalStore: store,
      isLeader: () => true,
    });

    // 0 credits, no keys -> false
    expect(agent.hasCredit()).toBe(false);

    // Provide OpenAI key -> default model ('gpt-4o') bypasses credit check
    localStorage.setItem('telegenie_ai_key_openai', 'sk-openai-test');
    expect(agent.hasCredit()).toBe(true);
    expect(agent.hasCredit('gpt-4o-mini')).toBe(true);

    // Gemini requires Google key
    expect(agent.hasCredit('gemini-3.8')).toBe(false);
    localStorage.setItem('telegenie_ai_key_google', 'ai-google-test');
    expect(agent.hasCredit('gemini-3.8')).toBe(true);

    // Claude requires Anthropic key
    expect(agent.hasCredit('claude-sonnet-5-5')).toBe(false);
    localStorage.setItem('telegenie_ai_key_anthropic', 'sk-ant-test');
    expect(agent.hasCredit('claude-sonnet-5-5')).toBe(true);

    // Switching selectedModel via agent controller
    agent.setSelectedModel('gemini-3.8');
    expect(agent.getSelectedModel()).toBe('gemini-3.8');
    expect(store.agent.selectedModel).toBe('gemini-3.8');
  });

  it('throws error when non-BYOK user has insufficient credits', async () => {
    const mockWorkerClient = {
      call: jest.fn().mockResolvedValue(undefined),
      worker: {} as any,
    };

    const globalStore = createTestStore(0);

    const agent = new AgentController({
      createWorkerClient: () => mockWorkerClient as any,
      globalStore,
      isLeader: () => true,
    });

    const res = await agent.syncDialogMemory('100', { fromDate: 1000, toDate: 2000 }) as any;
    expect(res.success).toBe(false);
    expect(res.error.message).toContain('Insufficient AI credits');
  });

  it('allows BYOK users to sync without credit limitation', async () => {
    const capturedCalls: Array<{ method: string; args: unknown[] }> = [];
    const mockWorkerClient = {
      call: jest.fn().mockImplementation((method: string, args: unknown[]) => {
        capturedCalls.push({ method, args });
        return Promise.resolve();
      }),
      worker: {} as any,
    };

    const mockBroadcast = {
      post: jest.fn(),
      on: jest.fn().mockReturnValue(() => undefined),
    };

    const globalStore = createTestStore(0);
    localStorage.setItem('telegenie_ai_key_openai', 'sk-test-byok');

    const agent = new AgentController({
      createWorkerClient: () => mockWorkerClient as any,
      globalStore,
      isLeader: () => true,
      broadcast: mockBroadcast as any,
    });

    await agent.syncDialogMemory('100', { fromDate: 1000, toDate: 2000 });
    // Should have proceeded to sync without throwing
    expect(mockBroadcast.post).toHaveBeenCalledWith(
      TAB_MSG.memorySyncComplete,
      expect.objectContaining({ peerId: '100', status: 'completed' }),
    );
  });

  it('posts memorySyncRequest to broadcast channel when called on a follower tab', async () => {
    const mockWorkerClient = {
      call: jest.fn().mockResolvedValue(undefined),
      worker: {} as any,
    };

    const mockBroadcast = {
      post: jest.fn(),
      on: jest.fn().mockReturnValue(() => undefined),
    };

    const globalStore = createTestStore(100);

    const agent = new AgentController({
      createWorkerClient: () => mockWorkerClient as any,
      isLeader: () => false,
      broadcast: mockBroadcast as any,
      globalStore,
    });

    await agent.syncDialogMemory('peer-456', { fromDate: 5000, toDate: 10000 });

    expect(mockBroadcast.post).toHaveBeenCalledWith(TAB_MSG.memorySyncRequest, {
      peerId: 'peer-456',
      fromDate: 5000,
      toDate: 10000,
    });
    expect(agent.isSyncing('peer-456')).toBe(true);
  });

  it('loads local messages and calls processMessagesWithCost on leader tab', async () => {
    const capturedCalls: Array<{ method: string; args: unknown[] }> = [];
    const mockWorkerClient = {
      call: jest.fn().mockImplementation((method: string, args: unknown[]) => {
        capturedCalls.push({ method, args });
        return Promise.resolve();
      }),
      worker: {} as any,
    };

    const mockBroadcast = {
      post: jest.fn(),
      on: jest.fn().mockReturnValue(() => undefined),
    };

    const mockMessages = new Map([
      ['10', { id: '10', date: 100, message: 'Alice plans to move to Berlin next month', isEmpty: false, out: false }],
      ['11', { id: '11', date: 110, message: 'Bob prefers TypeScript over Python', isEmpty: false, out: true }],
      ['12', { id: '12', date: 200, message: 'Outside range', isEmpty: false, out: false }],
    ]);

    const mockMessageStore = {
      getAllData: () => mockMessages,
    };

    const globalStore = createTestStore(100);

    const agent = new AgentController({
      createWorkerClient: () => mockWorkerClient as any,
      isLeader: () => true,
      broadcast: mockBroadcast as any,
      ensureMessageStore: () => mockMessageStore as any,
      globalStore,
    });

    await agent.syncDialogMemory('dialog-789', { fromDate: 50 * 1000, toDate: 150 * 1000 });

    // Should call processMessagesWithCost with the 2 matching messages and 'memory extraction' cost source
    const extractionCall = capturedCalls.find((c) => c.method === 'processMessagesWithCost');
    expect(extractionCall).toBeDefined();
    expect(extractionCall?.args[1]).toBe('memory extraction');
    const records = extractionCall?.args[0] as Array<{ id: string; message: string }>;
    expect(records).toHaveLength(2);
    expect(records[0].id).toBe('dialog-789:10');
    expect(records[1].id).toBe('dialog-789:11');

    // Should update IDB status to completed
    const finalUpsert = capturedCalls.find(
      (c) => c.method === 'upsertDialogMemorySync' && (c.args[0] as any).status === 'completed',
    );
    expect(finalUpsert).toBeDefined();

    // Should post complete event
    expect(mockBroadcast.post).toHaveBeenCalledWith(
      TAB_MSG.memorySyncComplete,
      expect.objectContaining({
        peerId: 'dialog-789',
        status: 'completed',
        totalSynced: 2,
      }),
    );
  });

  it('notifies local onMemorySyncComplete and updates IDB on sync failure', async () => {
    const capturedCalls: Array<{ method: string; args: unknown[] }> = [];
    const mockWorkerClient = {
      call: jest.fn().mockImplementation((method: string, args: unknown[]) => {
        capturedCalls.push({ method, args });
        if (method === 'processMessagesWithCost') {
          return Promise.reject(new Error('Network error during extraction'));
        }
        return Promise.resolve();
      }),
      worker: {} as any,
    };

    const mockBroadcast = {
      post: jest.fn(),
      on: jest.fn().mockReturnValue(() => undefined),
    };

    const mockMessages = new Map([
      ['10', { id: '10', date: 100, message: 'Test message', isEmpty: false, out: false }],
    ]);

    const mockMessageStore = {
      getAllData: () => mockMessages,
    };

    const globalStore = createTestStore(100);

    const agent = new AgentController({
      createWorkerClient: () => mockWorkerClient as any,
      isLeader: () => true,
      broadcast: mockBroadcast as any,
      ensureMessageStore: () => mockMessageStore as any,
      globalStore,
    });

    const completeListener = jest.fn();
    agent.onMemorySyncComplete(completeListener);

    await agent.syncDialogMemory('dialog-fail', { fromDate: 50 * 1000, toDate: 150 * 1000 });

    expect(agent.isSyncing('dialog-fail')).toBe(false);

    // Verifies local listener fired with failed status and error
    expect(completeListener).toHaveBeenCalledWith(
      expect.objectContaining({
        peerId: 'dialog-fail',
        status: 'failed',
        error: 'Network error during extraction',
      }),
    );

    // Verifies IDB upsert called with failed status and error
    const failedUpsert = capturedCalls.find(
      (c) => c.method === 'upsertDialogMemorySync' && (c.args[0] as any).status === 'failed',
    );
    expect(failedUpsert).toBeDefined();
  });

  it('falls back to loadHistory to paginate older messages if not in local store', async () => {
    const capturedCalls: Array<{ method: string; args: unknown[] }> = [];
    const mockWorkerClient = {
      call: jest.fn().mockImplementation((method: string, args: unknown[]) => {
        capturedCalls.push({ method, args });
        return Promise.resolve();
      }),
      worker: {} as any,
    };

    const mockBroadcast = {
      post: jest.fn(),
      on: jest.fn().mockReturnValue(() => undefined),
    };

    // Only message 20 is cached locally
    const mockMessages = new Map([
      ['20', { id: '20', date: 200, message: 'Newer local message', isEmpty: false, out: false }],
    ]);

    const mockLoadHistory = jest.fn().mockResolvedValue({
      messages: [
        { id: 10, peerId: 'dialog-load', date: 100, message: 'Older message from history', out: false, isEmpty: false },
      ],
      count: 1,
    });

    const globalStore = createTestStore(100);

    const agent = new AgentController({
      createWorkerClient: () => mockWorkerClient as any,
      isLeader: () => true,
      broadcast: mockBroadcast as any,
      ensureMessageStore: () => ({ getAllData: () => mockMessages }) as any,
      loadHistory: mockLoadHistory,
      globalStore,
    });

    await agent.syncDialogMemory('dialog-load', { fromDate: 50 * 1000, toDate: 250 * 1000 });

    expect(mockLoadHistory).toHaveBeenCalledWith(
      'dialog-load',
      expect.objectContaining({
        direction: 'backwards',
        offsetId: 20,
      }),
    );

    const extractionCall = capturedCalls.find((c) => c.method === 'processMessagesWithCost');
    expect(extractionCall).toBeDefined();
    const records = extractionCall?.args[0] as Array<{ id: string; message: string }>;
    expect(records.map((r) => r.id)).toEqual(['dialog-load:10', 'dialog-load:20']);
  });

  describe('Incremental Memory Extraction Queue', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('queues messages and flushes them after 1 minute when < 50 messages', async () => {
      const capturedCalls: Array<{ method: string; args: unknown[] }> = [];
      const mockWorkerClient = {
        call: jest.fn().mockImplementation((method: string, args: unknown[]) => {
          capturedCalls.push({ method, args });
          if (method === 'getDialogMemorySync') {
            return Promise.resolve({
              peerId: 'peer-99',
              incrementalSync: true,
              lastSyncAt: 1000,
              syncedMessageCount: 5,
            });
          }
          return Promise.resolve();
        }),
        worker: {} as any,
      };

      const globalStore = createTestStore(100);

      const agent = new AgentController({
        createWorkerClient: () => mockWorkerClient as any,
        isLeader: () => true,
        globalStore,
      });

      await agent.handleIncomingMessage({
        id: '55',
        peerId: 'peer-99',
        date: 2000,
        message: 'Charlie is launching project Apollo tomorrow',
        out: false,
      } as any);

      // Should NOT have called processMessagesWithCost immediately since queue has only 1 message
      let extractionCall = capturedCalls.find((c) => c.method === 'processMessagesWithCost');
      expect(extractionCall).toBeUndefined();

      // Advance timers by 60 seconds (1 minute)
      await jest.advanceTimersByTimeAsync(60_000);

      // Now it should have flushed
      extractionCall = capturedCalls.find((c) => c.method === 'processMessagesWithCost');
      expect(extractionCall).toBeDefined();
      expect(extractionCall?.args[1]).toBe('memory extraction');
      const records = extractionCall?.args[0] as Array<{ id: string; message: string }>;
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe('peer-99:55');
    });

    it('automatically flushes when queue reaches 50 messages', async () => {
      const capturedCalls: Array<{ method: string; args: unknown[] }> = [];
      const mockWorkerClient = {
        call: jest.fn().mockImplementation((method: string, args: unknown[]) => {
          capturedCalls.push({ method, args });
          if (method === 'getDialogMemorySync') {
            return Promise.resolve({
              peerId: 'peer-batch',
              incrementalSync: true,
              lastSyncAt: 1000,
              syncedMessageCount: 0,
            });
          }
          return Promise.resolve();
        }),
        worker: {} as any,
      };

      const globalStore = createTestStore(100);

      const agent = new AgentController({
        createWorkerClient: () => mockWorkerClient as any,
        isLeader: () => true,
        globalStore,
      });

      // Send 49 messages
      for (let i = 1; i <= 49; i++) {
        await agent.handleIncomingMessage({
          id: String(i),
          peerId: 'peer-batch',
          date: 1000 + i,
          message: `Message number ${i}`,
          out: false,
        } as any);
      }

      // Still should not have flushed
      expect(capturedCalls.find((c) => c.method === 'processMessagesWithCost')).toBeUndefined();

      // 50th message triggers flush
      await agent.handleIncomingMessage({
        id: '50',
        peerId: 'peer-batch',
        date: 1050,
        message: 'Message number 50',
        out: false,
      } as any);

      const extractionCall = capturedCalls.find((c) => c.method === 'processMessagesWithCost');
      expect(extractionCall).toBeDefined();
      const records = extractionCall?.args[0] as Array<{ id: string; message: string }>;
      expect(records).toHaveLength(50);
      expect(records[0].id).toBe('peer-batch:1');
      expect(records[49].id).toBe('peer-batch:50');
    });

    it('does not sync if no messages in queue', async () => {
      const mockWorkerClient = {
        call: jest.fn().mockResolvedValue(undefined),
        worker: {} as any,
      };

      const globalStore = createTestStore(100);

      const agent = new AgentController({
        createWorkerClient: () => mockWorkerClient as any,
        isLeader: () => true,
        globalStore,
      });

      await agent.flushIncrementalQueue('empty-peer');
      expect(mockWorkerClient.call).not.toHaveBeenCalled();
    });

    it('ignores incoming messages when tab is not leader', async () => {
      const mockWorkerClient = {
        call: jest.fn().mockResolvedValue(undefined),
        worker: {} as any,
      };

      const globalStore = createTestStore(100);

      const agent = new AgentController({
        createWorkerClient: () => mockWorkerClient as any,
        isLeader: () => false,
        globalStore,
      });

      await agent.handleIncomingMessage({
        id: '1',
        peerId: 'peer-follower',
        date: 1000,
        message: 'Test message',
        out: false,
      } as any);

      expect(mockWorkerClient.call).not.toHaveBeenCalled();
    });

    it('allows BYOK users to flush incremental queue without credit limitation', async () => {
      const capturedCalls: Array<{ method: string; args: unknown[] }> = [];
      const mockWorkerClient = {
        call: jest.fn().mockImplementation((method: string, args: unknown[]) => {
          capturedCalls.push({ method, args });
          if (method === 'getDialogMemorySync') {
            return Promise.resolve({
              peerId: 'peer-byok',
              incrementalSync: true,
              lastSyncAt: 1000,
              syncedMessageCount: 0,
            });
          }
          return Promise.resolve();
        }),
        worker: {} as any,
      };

      const globalStore = createTestStore(0);
      localStorage.setItem('telegenie_ai_key_openai', 'sk-test-byok');

      const agent = new AgentController({
        createWorkerClient: () => mockWorkerClient as any,
        isLeader: () => true,
        globalStore,
      });

      await agent.handleIncomingMessage({
        id: '10',
        peerId: 'peer-byok',
        date: 1010,
        message: 'BYOK incremental test',
        out: false,
      } as any);

      await jest.advanceTimersByTimeAsync(60_000);

      const extractionCall = capturedCalls.find((c) => c.method === 'processMessagesWithCost');
      expect(extractionCall).toBeDefined();
      const records = extractionCall?.args[0] as Array<{ id: string; message: string }>;
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe('peer-byok:10');
    });
  });
});
