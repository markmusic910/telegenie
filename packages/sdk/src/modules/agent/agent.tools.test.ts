import type { AgentWorkerClient } from '@telegenie/agent/worker';
import { z } from 'zod';
import { AgentController } from './agent.controller';

describe('AgentController tab tool registration & completeInput', () => {
  function createMockWorker() {
    const call = jest.fn().mockResolvedValue(undefined);
    const worker = {
      call,
      worker: {
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    } as unknown as AgentWorkerClient;
    return { worker, call };
  }

  it('serializes Zod v4 schema to JSON Schema, syncs on connectPageBridge, and validates args on invokeTool', async () => {
    const { worker, call } = createMockWorker();
    const agent = new AgentController({
      createWorkerClient: () => worker,
    });

    const handler = jest.fn(async ({ suggestions }: { suggestions: Array<{ text: string }> }) => ({
      delivered: suggestions.length,
    }));

    const unregister = agent.registerTool(
      {
        name: 'suggest_input_completions',
        description: 'Present suggestions',
        parameters: z.object({
          suggestions: z.array(z.object({ text: z.string().min(1) })).min(1),
        }),
        scope: 'composer',
      },
      handler,
    );

    // Before bridge connect, nothing synced yet
    expect(call).not.toHaveBeenCalledWith('setTabTools', expect.anything());

    // Connecting bridge syncs already-registered tools
    await agent.connectPageBridge();
    expect(call).toHaveBeenCalledWith('setTabTools', [
      [
        expect.objectContaining({
          name: 'suggest_input_completions',
          description: 'Present suggestions',
          scope: 'composer',
          parameters: expect.objectContaining({
            type: 'object',
            properties: expect.objectContaining({
              suggestions: expect.any(Object),
            }),
          }),
        }),
      ],
    ]);

    // Invoke via TabPage's onInvokeTool callback (as the agent worker would over MessageChannel)
    const tabPage = (
      agent as unknown as {
        tabPage: {
          onInvokeTool: (
            name: string,
            args: Record<string, unknown>,
            ctx: { runId: string; peerId?: string },
          ) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
        };
      }
    ).tabPage;

    const okRes = await tabPage.onInvokeTool(
      'suggest_input_completions',
      { suggestions: [{ text: 'Hello!' }] },
      { runId: 'run-1', peerId: '42' },
    );
    expect(okRes).toEqual({ ok: true, result: { delivered: 1 } });
    expect(handler).toHaveBeenCalledWith(
      { suggestions: [{ text: 'Hello!' }] },
      { runId: 'run-1', peerId: '42' },
    );

    // Invalid args fail Zod safeParse before reaching handler
    const badRes = await tabPage.onInvokeTool(
      'suggest_input_completions',
      { suggestions: [] },
      { runId: 'run-1', peerId: '42' },
    );
    expect(badRes.ok).toBe(false);
    expect(badRes.error).toContain('Invalid arguments');

    // Unregistering syncs empty list to worker
    unregister();
    expect(call).toHaveBeenLastCalledWith('setTabTools', [[]]);

    // Close MessageChannel ports so Jest exits cleanly
    agent.disconnectPageBridge();
  });

  it('forwards lightweight identifiers to worker completeInput without assembling messages on tab', async () => {
    const { worker, call } = createMockWorker();
    call.mockImplementation(async (method: string) => {
      if (method === 'completeInput') {
        return { options: [{ text: 'Sure, see you at 3pm!', label: 'Natural' }] };
      }
      return undefined;
    });

    const ensureMessageStore = jest.fn();
    const agent = new AgentController({
      createWorkerClient: () => worker,
      ensureMessageStore,
    });
    // Mark model configured so completeInput doesn't call configureModel in this unit test
    (agent as unknown as { isModelConfigured: boolean }).isModelConfigured = true;

    const result = await agent.completeInput({
      peerId: '42',
      currentInput: 'Sure, ',
      replyToMessageId: '10',
      editingMessageId: '11',
      maxOptions: 3,
    });

    expect(result.options).toEqual([{ text: 'Sure, see you at 3pm!', label: 'Natural' }]);
    expect(ensureMessageStore).not.toHaveBeenCalled();
    expect(call).toHaveBeenCalledWith('completeInput', [
      expect.objectContaining({
        peerId: '42',
        currentInput: 'Sure, ',
        replyToMessageId: '10',
        editingMessageId: '11',
        maxOptions: 3,
      }),
    ]);
  });
});
