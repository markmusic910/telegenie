import { ContextBuilder, resolveTonePrompt, DEFAULT_TONE_PROMPTS } from './context-builder';
import type { RetrievalContext } from './context-builder';

describe('resolveTonePrompt', () => {
  it('resolves built-in tone identifiers to rich prompt directives', () => {
    expect(resolveTonePrompt({ tone: 'professional' })).toBe(DEFAULT_TONE_PROMPTS.professional);
    expect(resolveTonePrompt({ tone: 'concise' })).toBe(DEFAULT_TONE_PROMPTS.concise);
    expect(resolveTonePrompt({ tone: 'friendly' })).toBe(DEFAULT_TONE_PROMPTS.friendly);
  });

  it('prefers explicit tonePrompt if provided', () => {
    expect(
      resolveTonePrompt({
        tone: 'custom',
        tonePrompt: 'Speak like a seasoned sailor.',
      }),
    ).toBe('Speak like a seasoned sailor.');
  });

  it('prefers explicit tonePrompt over built-in tone id', () => {
    expect(
      resolveTonePrompt({
        tone: 'professional',
        tonePrompt: 'Explicit custom override prompt.',
      }),
    ).toBe('Explicit custom override prompt.');
  });

  it('falls back to raw tone string if not recognized as built-in id', () => {
    expect(
      resolveTonePrompt({
        tone: 'Answer exclusively in haikus.',
      }),
    ).toBe('Answer exclusively in haikus.');
  });

  it('returns undefined if no tone is provided', () => {
    expect(resolveTonePrompt(undefined)).toBeUndefined();
    expect(resolveTonePrompt({})).toBeUndefined();
  });
});

describe('ContextBuilder', () => {
  const builder = new ContextBuilder();

  it('builds context with full tone prompt directive instead of single-word tone', () => {
    const context: RetrievalContext = {
      memories: [],
      messages: [],
      entities: [],
      dialogPreset: {
        peerId: '12345',
        background: 'Family chat with siblings',
        tone: 'friendly',
        createdAt: 1000,
        updatedAt: 1000,
      },
    };

    const output = builder.build(context);
    expect(output).toContain('## Dialog Background & User Directives');
    expect(output).toContain('- Background: Family chat with siblings');
    expect(output).toContain(`- Required Tone: ${DEFAULT_TONE_PROMPTS.friendly}`);
    expect(output).not.toContain('- Required Tone: friendly');
  });

  it('includes active skills directives in context', () => {
    const context: RetrievalContext = {
      memories: [],
      messages: [],
      entities: [],
      activeSkills: [
        {
          id: 'meeting-summarizer',
          title: 'Meeting Summarizer',
          content: 'Extract all action items and deadlines.',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    };

    const output = builder.build(context);
    expect(output).toContain('## Active Dialog Skills');
    expect(output).toContain('### Skill: Meeting Summarizer');
    expect(output).toContain('Extract all action items and deadlines.');
  });

  it('includes active dialog metadata and resolves participant names in messages chronologically', () => {
    const context: RetrievalContext = {
      memories: [],
      entities: [],
      peerId: '42',
      dialogContext: {
        peerId: '42',
        peerName: 'y1',
        peerType: 'user',
        peers: {
          '42': { id: '42', name: 'y1', username: 'y1_dev', type: 'user' },
          '99': { id: '99', name: 'Mark', type: 'user', isSelf: true },
        },
      },
      messages: [
        {
          id: '42:2',
          peerId: '42',
          fromId: '99',
          date: 2000,
          message: 'Sounds good, see you at 5!',
          out: true,
        },
        {
          id: '42:1',
          peerId: '42',
          fromId: '42',
          date: 1000,
          message: 'Want to grab coffee today?',
          out: false,
        },
      ],
    };

    const output = builder.build(context);
    expect(output).toContain('## Active Dialog');
    expect(output).toContain('- Name: y1');
    expect(output).toContain('- Type: user');
    expect(output).toContain('- Peer ID: 42');
    expect(output).toContain('y1 (@y1_dev)');
    expect(output).toContain('Mark [Me]');
    expect(output).toContain('## Recent & Relevant Dialog Messages');
    expect(output).toContain('y1 (@y1_dev): "Want to grab coffee today?"');
    expect(output).toContain('Me: "Sounds good, see you at 5!"');

    // Earlier message appears before later message
    const firstIdx = output.indexOf('Want to grab coffee today?');
    const secondIdx = output.indexOf('Sounds good, see you at 5!');
    expect(firstIdx).toBeGreaterThan(-1);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });
});

