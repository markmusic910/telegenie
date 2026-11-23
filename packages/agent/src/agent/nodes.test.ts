import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { END } from '@langchain/langgraph';
import {
  MAX_TOOL_ITERATIONS,
  initNodes,
  retrieveNode,
  shouldContinueTools,
  toolsNode,
} from './nodes';
import type { AgentGraphState } from './state';
import type { Retriever } from '../runtime/retriever';

jest.mock('./tools', () => {
  const actual = jest.requireActual('./tools');
  return {
    ...actual,
    resolveAgentTools: jest.fn(actual.resolveAgentTools),
  };
});

jest.mock('../worker/tab-page-client', () => ({
  hasTabPageClient: jest.fn(() => false),
  getTabPageClient: jest.fn(),
}));

import { resolveAgentTools } from './tools';
import { getTabPageClient, hasTabPageClient } from '../worker/tab-page-client';

const mockedResolveAgentTools = resolveAgentTools as jest.MockedFunction<typeof resolveAgentTools>;
const mockedHasTabPageClient = hasTabPageClient as jest.MockedFunction<typeof hasTabPageClient>;
const mockedGetTabPageClient = getTabPageClient as jest.MockedFunction<typeof getTabPageClient>;

describe('retrieveNode', () => {
  it('retrieves recent conversation messages and dialogContext via Retriever when peerId is set', async () => {
    const getConversation = jest.fn().mockResolvedValue([
      {
        id: '42:11',
        peerId: '42',
        fromId: '42',
        date: 1100,
        message: 'Latest message in y1',
        out: false,
      },
      {
        id: '42:10',
        peerId: '42',
        fromId: '99',
        date: 1000,
        message: 'Earlier cached message',
        out: true,
      },
    ]);
    const searchMessages = jest.fn().mockResolvedValue([
      {
        id: '42:5',
        peerId: '42',
        fromId: '42',
        date: 500,
        message: 'Older keyword match',
        out: false,
      },
    ]);
    const getDialogContext = jest.fn().mockResolvedValue({
      peerId: '42',
      peerName: 'y1',
      peerType: 'user',
      peers: {
        '42': { id: '42', name: 'y1', username: 'y1_dev', type: 'user' },
      },
    });
    const searchKnowledgeGraph = jest.fn().mockResolvedValue({ memories: [], entities: [] });
    const getDialogPreset = jest.fn().mockResolvedValue(undefined);

    const fakeRetriever = {
      getConversation,
      searchMessages,
      getDialogContext,
      searchKnowledgeGraph,
      getDialogPreset,
      searchMemories: jest.fn().mockResolvedValue([]),
    } as unknown as Retriever;

    initNodes(fakeRetriever);

    const state: AgentGraphState = {
      messages: [new HumanMessage('what do you know about this dialog?')],
      intent: 'FACT',
      retrievedMemories: [],
      retrievedEntities: [],
      retrievedMessages: [],
      runId: 'run-1',
      peerId: '42',
      dialogContext: undefined,
      dialogPreset: undefined,
      model: undefined,
      presetId: undefined,
      thought: undefined,
      toolIterations: 0,
      toolTraceSteps: [],
    };

    const result = await retrieveNode(state);

    expect(getConversation).toHaveBeenCalledWith('42', 30);
    expect(getDialogContext).toHaveBeenCalledWith('42', result.retrievedMessages);
    expect(result.retrievedMessages?.map((m) => m.id)).toEqual(['42:11', '42:10', '42:5']);
    expect(result.dialogContext).toEqual({
      peerId: '42',
      peerName: 'y1',
      peerType: 'user',
      peers: {
        '42': { id: '42', name: 'y1', username: 'y1_dev', type: 'user' },
      },
    });
  });
});

describe('shouldContinueTools', () => {
  const baseState = (): AgentGraphState => ({
    messages: [],
    intent: 'GENERAL',
    retrievedMemories: [],
    retrievedEntities: [],
    retrievedMessages: [],
    runId: 'run-1',
    peerId: '42',
    dialogContext: undefined,
    dialogPreset: undefined,
    model: undefined,
    presetId: undefined,
    thought: undefined,
    toolIterations: 0,
    toolTraceSteps: [],
  });

  it('routes to tools when last AIMessage has tool_calls and under MAX_TOOL_ITERATIONS', () => {
    const state = {
      ...baseState(),
      messages: [
        new AIMessage({
          content: '',
          tool_calls: [{ id: 'tc-1', name: 'get_dialog_memory_sync', args: {} }],
        }),
      ],
      toolIterations: 0,
    };
    expect(shouldContinueTools(state)).toBe('tools');
  });

  it('routes to END when toolIterations reaches MAX_TOOL_ITERATIONS', () => {
    const state = {
      ...baseState(),
      messages: [
        new AIMessage({
          content: '',
          tool_calls: [{ id: 'tc-1', name: 'get_dialog_memory_sync', args: {} }],
        }),
      ],
      toolIterations: MAX_TOOL_ITERATIONS,
    };
    expect(shouldContinueTools(state)).toBe(END);
  });

  it('routes to END when last AIMessage has no tool calls', () => {
    const state = {
      ...baseState(),
      messages: [new AIMessage('Done')],
    };
    expect(shouldContinueTools(state)).toBe(END);
  });
});

describe('toolsNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('executes resolved tools, emits TabPageApi.toolCallEvent, and returns ToolMessages', async () => {
    const invoke = jest.fn().mockResolvedValue(JSON.stringify({ count: 1 }));
    const fakeTool = { name: 'get_dialog_memory_sync', invoke };
    mockedResolveAgentTools.mockReturnValue({
      tools: [fakeTool as never],
      toolsByName: new Map([['get_dialog_memory_sync', fakeTool as never]]),
    });

    const tabCall = jest.fn().mockResolvedValue(undefined);
    mockedHasTabPageClient.mockReturnValue(true);
    mockedGetTabPageClient.mockReturnValue({ call: tabCall } as never);

    const state: AgentGraphState = {
      messages: [
        new AIMessage({
          content: '',
          tool_calls: [{ id: 'call_1', name: 'get_dialog_memory_sync', args: { peerId: '42' } }],
        }),
      ],
      intent: 'FACT',
      retrievedMemories: [],
      retrievedEntities: [],
      retrievedMessages: [],
      runId: 'run-1',
      peerId: '42',
      dialogContext: undefined,
      dialogPreset: undefined,
      model: undefined,
      presetId: undefined,
      thought: undefined,
      toolIterations: 0,
      toolTraceSteps: [],
    };

    const result = await toolsNode(state);

    expect(invoke).toHaveBeenCalledWith({ peerId: '42' });
    expect(result.toolIterations).toBe(1);
    expect(result.messages).toHaveLength(1);
    expect(result.messages?.[0]).toBeInstanceOf(ToolMessage);
    expect((result.messages?.[0] as ToolMessage).content).toBe('{"count":1}');
    expect(tabCall).toHaveBeenCalledWith('toolCallEvent', [
      expect.objectContaining({
        runId: 'run-1',
        toolCallId: 'call_1',
        toolName: 'get_dialog_memory_sync',
        status: 'start',
      }),
    ]);
    expect(tabCall).toHaveBeenCalledWith('toolCallEvent', [
      expect.objectContaining({
        runId: 'run-1',
        toolCallId: 'call_1',
        toolName: 'get_dialog_memory_sync',
        status: 'result',
        result: { count: 1 },
      }),
    ]);
  });
});
