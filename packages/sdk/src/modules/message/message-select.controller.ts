import { Controller, Method, RequestLog } from '@telegenie/decorators';
import type { Message } from '../../store/entity/models/message.model';
import type GlobalStore from '../../store/global/global.store';
import { MAIN_THREAD_ID } from '../../store/global/models/thread.state';
import type { MessageStore } from '../../store/types';
import { messageCopyText } from './message-copy-text';

type MessageSelectControllerOptions = {
  globalStore: GlobalStore;
  ensureMessageStore: (peerId: string) => MessageStore;
};

export type ToggleSelectionInput = {
  messageId: string;
  /** Every id of an album row. Toggled together with `messageId`. */
  childMessageIds?: readonly string[];
  /** Shift-click: also select the listed rows between the last selected id and this one. */
  withShift?: boolean;
};

function isSelectableId(id: string): boolean {
  const numeric = Number(id);
  return Number.isInteger(numeric) && numeric > 0;
}

/**
 * Message selection mode for one `(peerId, threadId)`. The selection lives on
 * `ThreadSlice`, is session-only, and this controller is its only writer.
 */
@Controller
export class MessageSelectController {
  constructor(private readonly options: MessageSelectControllerOptions) {}

  /** Turn selection mode on, optionally selecting `ids` right away. */
  @RequestLog()
  @Method()
  enter(peerId: string, ids: readonly string[] = [], threadId: string = MAIN_THREAD_ID): void {
    this.options.globalStore
      .getOrCreateThreadUI(peerId, threadId)
      .enterSelectMode(ids.filter(isSelectableId));
  }

  /** Toggle one row. Removing the last selected id leaves selection mode. */
  @RequestLog()
  @Method()
  toggle(peerId: string, input: ToggleSelectionInput, threadId: string = MAIN_THREAD_ID): void {
    const ids = [...new Set([input.messageId, ...(input.childMessageIds ?? [])])].filter(
      isSelectableId,
    );
    if (ids.length === 0) return;
    const thread = this.options.globalStore.getOrCreateThreadUI(peerId, threadId);
    const range = input.withShift ? this.shiftRange(peerId, threadId, input.messageId) : undefined;
    thread.toggleSelected(ids, range);
  }

  @RequestLog()
  @Method()
  exit(peerId: string, threadId: string = MAIN_THREAD_ID): void {
    this.options.globalStore.getThreadUI(peerId, threadId)?.clearSelection();
  }

  /** Selected messages that are still in the store, oldest first. */
  @RequestLog()
  @Method()
  getSelectedMessages(peerId: string, threadId: string = MAIN_THREAD_ID): Message[] {
    const thread = this.options.globalStore.getThreadUI(peerId, threadId);
    if (!thread) return [];
    const data = this.options.ensureMessageStore(peerId).getAllData();
    const messages: Message[] = [];
    for (const id of thread.selectedMessageIds) {
      const message = data.get(id) as Message | undefined;
      if (message && !message.isEmpty) messages.push(message);
    }
    return messages.sort((a, b) => Number(a.id) - Number(b.id));
  }

  /** Clipboard text for the selection: one line block per message, oldest first. */
  @RequestLog()
  @Method()
  copyText(peerId: string, threadId: string = MAIN_THREAD_ID): string {
    return this.getSelectedMessages(peerId, threadId)
      .filter((message) => message.kind === 'message')
      .map((message) => messageCopyText(message))
      .filter((text) => text.length > 0)
      .join('\n');
  }

  /** Rows between the last selected id and `messageId` in the thread's listed window. */
  private shiftRange(peerId: string, threadId: string, messageId: string): string[] | undefined {
    const thread = this.options.globalStore.getThreadUI(peerId, threadId);
    const selected = thread?.selectedMessageIds;
    if (!thread || !selected?.length) return undefined;
    const listed = thread.listedIds;
    const anchorIndex = listed.indexOf(selected[selected.length - 1]);
    const targetIndex = listed.indexOf(messageId);
    if (anchorIndex === -1 || targetIndex === -1) return undefined;
    const from = Math.min(anchorIndex, targetIndex);
    const to = Math.max(anchorIndex, targetIndex);
    const data = this.options.ensureMessageStore(peerId).getAllData();
    return listed.slice(from, to + 1).filter((id) => {
      const message = data.get(id) as Message | undefined;
      return message?.kind === 'message' && isSelectableId(id);
    });
  }
}
