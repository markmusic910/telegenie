import { AIMessage } from '@langchain/core/messages';
import type { Retriever } from '../runtime/retriever';
import {
  COMPOSER_TOOL_SUGGEST_INPUT_COMPLETIONS,
  runInputCompletion,
} from './input-completion';

describe('runInputCompletion', () => {
  it('enriches prompt with draft, replyTo, recentMessages, dialogContext, and memories, and invokes suggest_input_completions', async () => {
    const fakeRetriever = {
      getDialogPreset: jest.fn().mockResolvedValue({
        peerId: '42',
        tone: 'friendly',
        background: 'Close colleague',
      }),
      getConversation: jest.fn().mockResolvedValue([
        {
          id: '42:10',
          peerId: '42',
          fromId: '42',
          date: 1000,
          message: 'Can we meet at 2pm?',
          out: false,
        },
      ]),
      getMessageById: jest.fn().mockResolvedValue({
        id: '42:11',
        peerId: '42',
        fromId: '99',
        date: 1100,
        message: 'Original text to edit',
        out: true,
      }),
      getDialogContext: jest.fn().mockResolvedValue({
        peerId: '42',
        peerName: 'Alice',
        peerType: 'user',
        peers: {
          '42': { id: '42', name: 'Alice', type: 'user' },
        },
      }),
      searchKnowledgeGraph: jest.fn().mockResolvedValue({
        memories: [],
        entities: [],
      }),
    } as unknown as Retriever;

    const toolInvoke = jest.fn().mockResolvedValue(JSON.stringify({ delivered: true, count: 3 }));
    const fakeSuggestTool = {
      name: COMPOSER_TOOL_SUGGEST_INPUT_COMPLETIONS,
      invoke: toolInvoke,
    };

    const capturedMessages: unknown[] = [];
    const boundInvoke = jest.fn(async (msgs: unknown[]) => {
      capturedMessages.push(...msgs);
      return new AIMessage({
        content: '',
        tool_calls: [
          {
            id: 'tc_complete_1',
            name: COMPOSER_TOOL_SUGGEST_INPUT_COMPLETIONS,
            args: {
              suggestions: [
                { text: 'Hey Alice, could we push it to 3pm instead?', label: 'Friendly' },
                { text: 'Would 3pm work for you?', label: 'Concise' },
                { text: '2pm is a bit tight for me — how about 3pm?', label: 'Casual' },
              ],
            },
          },
        ],
      });
    });

    const fakeModel = {
      bindTools: jest.fn(() => ({ invoke: boundInvoke })),
      invoke: boundInvoke,
    };

    const result = await runInputCompletion(
      {
        peerId: '42',
        currentInput: 'Hey Alice, could we',
        replyToMessageId: '10',
        editingMessageId: '11',
        maxOptions: 3,
      },
      {
        retriever: fakeRetriever,
        createModel: () => fakeModel as never,
        resolveTools: () => ({
          tools: [fakeSuggestTool as never],
          toolsByName: new Map([[COMPOSER_TOOL_SUGGEST_INPUT_COMPLETIONS, fakeSuggestTool as never]]),
        }),
      },
    );

    expect(fakeModel.bindTools).toHaveBeenCalledWith([fakeSuggestTool]);
    expect(toolInvoke).toHaveBeenCalledWith({
      suggestions: [
        { text: 'Hey Alice, could we push it to 3pm instead?', label: 'Friendly' },
        { text: 'Would 3pm work for you?', label: 'Concise' },
        { text: '2pm is a bit tight for me — how about 3pm?', label: 'Casual' },
      ],
    });
    expect(result.options).toHaveLength(3);
    expect(result.options[0].text).toContain('3pm');

    const promptCombined = capturedMessages
      .map((m) => String((m as { content?: unknown }).content ?? ''))
      .join('\n');
    expect(promptCombined).toContain('Hey Alice, could we');
    expect(promptCombined).toContain('Can we meet at 2pm?');
    expect(promptCombined).toContain('Original text to edit');
    expect(promptCombined).toContain('Alice');
    expect(fakeRetriever.getMessageById).toHaveBeenCalledWith('42', '11');
  });

  it('falls back to parsing JSON text when the model does not call the tool', async () => {
    const fakeRetriever = {
      getDialogPreset: jest.fn().mockResolvedValue(undefined),
      getConversation: jest.fn().mockResolvedValue([]),
      getDialogContext: jest.fn().mockResolvedValue({ peerId: '42' }),
      searchKnowledgeGraph: jest.fn().mockResolvedValue({ memories: [], entities: [] }),
    } as unknown as Retriever;

    const fakeModel = {
      invoke: jest.fn().mockResolvedValue(
        new AIMessage(
          JSON.stringify({
            suggestions: [
              { text: 'Sounds good!', label: 'Concise' },
              { text: 'That works great for me, thanks!', label: 'Warm' },
            ],
          }),
        ),
      ),
    };

    const result = await runInputCompletion(
      { peerId: '42', currentInput: '' },
      {
        retriever: fakeRetriever,
        createModel: () => fakeModel as never,
        resolveTools: () => ({ tools: [], toolsByName: new Map() }),
      },
    );

    expect(result.options).toEqual([
      { text: 'Sounds good!', label: 'Concise' },
      { text: 'That works great for me, thanks!', label: 'Warm' },
    ]);
  });
});
