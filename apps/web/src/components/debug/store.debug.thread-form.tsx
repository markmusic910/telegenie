'use client';

import { Form } from '@/lib/components/ui/form';
import { useSDK } from '@/lib/contexts/sdk.context';
import {
  MAIN_THREAD_ID,
  coerceMessageCacheIndex,
  type MessageCacheIndex,
  type MessageDraft,
  type ThreadUIState,
} from '@telegenie/sdk';
import { runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { BooleanField, JsonField, PrimitiveField } from './store.debug.fields';

type WritableThreadUI = Omit<ThreadUIState, 'hasMoreOlder' | 'hasMoreNewer' | 'flatItems'>;

type ThreadFieldSpec =
  | { key: keyof WritableThreadUI; kind: 'boolean' }
  | { key: keyof WritableThreadUI; kind: 'number'; optional?: boolean }
  | { key: keyof WritableThreadUI; kind: 'string' }
  | { key: 'listedIds' | 'replyStack'; kind: 'json'; json: 'string[]' }
  | { key: 'msgIndexes'; kind: 'json'; json: 'msgIndexes' }
  | { key: 'draft'; kind: 'json'; json: 'draft' };

const THREAD_FIELDS: ThreadFieldSpec[] = [
  { key: 'scrollOffset', kind: 'number' },
  { key: 'scrollAnchorItemId', kind: 'string' },
  { key: 'scrollAnchorOffsetInItem', kind: 'number', optional: true },
  { key: 'scrollListedMinId', kind: 'string' },
  { key: 'scrollListedMaxId', kind: 'string' },
  { key: 'pinToBottom', kind: 'boolean' },
  { key: 'listedFollowsNewest', kind: 'boolean' },
  { key: 'pendingNewerCount', kind: 'number' },
  { key: 'unreadDividerId', kind: 'string' },
  { key: 'historyLoaded', kind: 'boolean' },
  { key: 'isLoadingHistory', kind: 'boolean' },
  { key: 'hasMoreHistory', kind: 'boolean' },
  { key: 'oldestMessageId', kind: 'string' },
  { key: 'listedIds', kind: 'json', json: 'string[]' },
  { key: 'msgIndexes', kind: 'json', json: 'msgIndexes' },
  { key: 'draft', kind: 'json', json: 'draft' },
  { key: 'editingId', kind: 'string' },
  { key: 'replyingToId', kind: 'string' },
  { key: 'replyStack', kind: 'json', json: 'string[]' },
  { key: 'focusedMessageId', kind: 'string' },
  { key: 'focusNoHighlight', kind: 'boolean' },
  { key: 'focusPending', kind: 'boolean' },
  { key: 'focusGeneration', kind: 'number' },
];

function writeThreadField(thread: WritableThreadUI, key: keyof WritableThreadUI, value: unknown) {
  runInAction(() => {
    (thread as unknown as Record<string, unknown>)[key] = value;
  });
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Expected a JSON array');
  return value.map((item) => String(item));
}

function parseDraft(value: unknown): MessageDraft | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected an object or null');
  }
  if (typeof (value as { text?: unknown }).text !== 'string') {
    throw new Error('draft.text must be a string');
  }
  return value as MessageDraft;
}

function formatJsonLength(
  spec: Extract<ThreadFieldSpec, { kind: 'json' }>,
  value: unknown,
): string | undefined {
  if (spec.key === 'listedIds') {
    return `length ${Array.isArray(value) ? value.length : 0}`;
  }
  if (spec.key === 'msgIndexes') {
    const index = value && typeof value === 'object' ? (value as MessageCacheIndex) : undefined;
    return `cachedIds ${Array.isArray(index?.cachedIds) ? index.cachedIds.length : 0}`;
  }
  return undefined;
}

function parseJsonField(spec: Extract<ThreadFieldSpec, { kind: 'json' }>, raw: string): unknown {
  const trimmed = raw.trim();
  if (spec.json === 'draft' && trimmed === '') return undefined;
  if (trimmed === '') {
    if (spec.json === 'string[]') return [];
    return coerceMessageCacheIndex({});
  }
  const parsed: unknown = JSON.parse(trimmed);
  if (spec.json === 'string[]') return parseStringArray(parsed);
  if (spec.json === 'msgIndexes') return coerceMessageCacheIndex(parsed);
  return parseDraft(parsed);
}

export const CurrentThreadUpdateForm = observer(function CurrentThreadUpdateForm() {
  const sdk = useSDK();
  const peerId = sdk.globalStore.nav.selectedDialogId;
  const threadId =
    (peerId ? sdk.globalStore.getDialogUI(peerId)?.activeThreadId : undefined) ??
    MAIN_THREAD_ID;
  const thread = peerId
    ? (sdk.globalStore.getThreadUI(peerId, threadId) as WritableThreadUI | undefined)
    : undefined;

  if (!peerId) {
    return <p className="px-1 py-2 text-xs text-muted-foreground">No dialog selected.</p>;
  }
  if (!thread) {
    return (
      <p className="px-1 py-2 text-xs text-muted-foreground">
        No thread UI for this dialog yet.
      </p>
    );
  }

  return (
    <Form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <p className="px-1 pb-1 font-mono text-[11px] text-muted-foreground">
        {peerId} · {threadId}
      </p>
      {THREAD_FIELDS.map((spec) => {
        const value = thread[spec.key];
        if (spec.kind === 'boolean') {
          return (
            <BooleanField
              key={spec.key}
              label={spec.key}
              onChange={(next) => writeThreadField(thread, spec.key, next)}
              value={Boolean(value)}
            />
          );
        }
        if (spec.kind === 'number') {
          return (
            <PrimitiveField
              key={spec.key}
              label={spec.key}
              onCommit={(raw) => {
                const trimmed = raw.trim();
                if (trimmed === '') {
                  if (!spec.optional) return false;
                  writeThreadField(thread, spec.key, undefined);
                  return true;
                }
                const next = Number(trimmed);
                if (!Number.isFinite(next)) return false;
                writeThreadField(thread, spec.key, next);
                return true;
              }}
              type="number"
              value={value == null ? '' : String(value)}
            />
          );
        }
        if (spec.kind === 'string') {
          return (
            <PrimitiveField
              key={spec.key}
              label={spec.key}
              onCommit={(raw) => {
                const trimmed = raw.trim();
                writeThreadField(thread, spec.key, trimmed === '' ? undefined : trimmed);
                return true;
              }}
              type="text"
              value={typeof value === 'string' ? value : ''}
            />
          );
        }
        return (
          <JsonField
            key={spec.key}
            label={spec.key}
            lengthHint={formatJsonLength(spec, value)}
            maxHeight={spec.key === 'listedIds' || spec.key === 'msgIndexes'}
            onCommit={(raw) => parseJsonField(spec, raw)}
            onWrite={(next) => writeThreadField(thread, spec.key, next)}
            value={value}
          />
        );
      })}
    </Form>
  );
});
