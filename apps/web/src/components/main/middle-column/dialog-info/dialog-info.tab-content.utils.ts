import type { Message } from '@telegenie/sdk';

export type DialogInfoMonthSection = {
  key: string;
  label: string;
  messages: Message[];
};

export function formatDialogInfoMonthLabel(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
}

export function groupMessagesByMonth(messages: Message[]): DialogInfoMonthSection[] {
  const sections: DialogInfoMonthSection[] = [];
  let current: DialogInfoMonthSection | null = null;

  for (const message of messages) {
    const label = formatDialogInfoMonthLabel(message.date);
    if (!current || current.label !== label) {
      current = {
        key: `${message.date}-${label}`,
        label,
        messages: [message],
      };
      sections.push(current);
    } else {
      current.messages.push(message);
    }
  }

  return sections;
}

export function isLinkMessage(message: Message): boolean {
  const media = message.media;
  return Boolean(media && typeof media === 'object' && 'webpage' in media);
}

export function formatSharedItemDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}