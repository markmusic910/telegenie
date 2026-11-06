export interface GenieToneOption {
  id: string;
  label: string;
  description: string;
  promptDirective?: string;
}

export const BUILTIN_TONES: GenieToneOption[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Balanced, helpful, and natural conversational tone.',
    promptDirective: 'Respond with a balanced, natural, helpful, and polite tone.',
  },
  {
    id: 'professional',
    label: 'Professional',
    description: 'Formal, objective, and business-appropriate.',
    promptDirective: 'Respond in a formal, objective, and professional business tone. Be precise and well-structured.',
  },
  {
    id: 'friendly',
    label: 'Friendly',
    description: 'Warm, empathetic, approachable, and encouraging.',
    promptDirective: 'Adopt a warm, encouraging, conversational, and empathetic tone.',
  },
  {
    id: 'concise',
    label: 'Concise & Direct',
    description: 'Succinct, no fluff, straight to the point.',
    promptDirective: 'Be extremely concise, direct, and succinct. Eliminate filler and pleasantries; state answers straight to the point.',
  },
  {
    id: 'humorous',
    label: 'Humorous',
    description: 'Witty, playful, and lighthearted.',
    promptDirective: 'Use a witty, engaging, lighthearted, and slightly playful tone.',
  },
  {
    id: 'custom',
    label: 'Custom Tone',
    description: 'Define your own tailored tone instructions.',
    promptDirective: '',
  },
];

