/** Text that Copy puts on the clipboard: the body, else the media summary. */
export function messageCopyText(message: { message: string; summaryText?: string }): string {
  if (message.message.trim()) return message.message;
  return message.summaryText ?? '';
}
