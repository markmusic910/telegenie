'use client';

import { Form } from '@/lib/components/ui/form';
import { useSDK } from '@/lib/contexts/sdk.context';
import { type DialogUIState } from '@telegenie/sdk';
import { runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { BooleanField, JsonField, PrimitiveField } from './store.debug.fields';

type WritableDialogUI = Omit<DialogUIState, 'getThread'>;

type DialogFieldSpec =
  | { key: keyof WritableDialogUI; kind: 'boolean' }
  | { key: keyof WritableDialogUI; kind: 'number' }
  | { key: keyof WritableDialogUI; kind: 'string' }
  | { key: 'unreadMentionIds'; kind: 'json'; json: 'string[]' }
  | { key: 'pinnedMessageIds'; kind: 'json'; json: 'number[]' };

const DIALOG_FIELDS: DialogFieldSpec[] = [
  { key: 'activeThreadId', kind: 'string' },
  { key: 'unreadMentionIds', kind: 'json', json: 'string[]' },
  { key: 'isPinnedViewOpen', kind: 'boolean' },
  { key: 'pinnedMessageIds', kind: 'json', json: 'number[]' },
  { key: 'pinnedMessagesCount', kind: 'number' },
  { key: 'currentPinnedIndex', kind: 'number' },
];

function writeDialogField(dialog: WritableDialogUI, key: keyof WritableDialogUI, value: unknown) {
  runInAction(() => {
    (dialog as unknown as Record<string, unknown>)[key] = value;
  });
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Expected a JSON array');
  return value.map((item) => String(item));
}

function parseNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) throw new Error('Expected a JSON array');
  return value.map((item) => {
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      throw new Error('Expected an array of numbers');
    }
    return item;
  });
}

function parseJsonField(spec: Extract<DialogFieldSpec, { kind: 'json' }>, raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === '') return [];
  const parsed: unknown = JSON.parse(trimmed);
  if (spec.json === 'number[]') return parseNumberArray(parsed);
  return parseStringArray(parsed);
}

export const CurrentDialogUpdateForm = observer(function CurrentDialogUpdateForm() {
  const sdk = useSDK();
  const peerId = sdk.globalStore.nav.selectedDialogId;
  const dialog = peerId
    ? (sdk.globalStore.getDialogUI(peerId) as WritableDialogUI | undefined)
    : undefined;

  if (!peerId) {
    return <p className="px-1 py-2 text-xs text-muted-foreground">No dialog selected.</p>;
  }
  if (!dialog) {
    return (
      <p className="px-1 py-2 text-xs text-muted-foreground">
        No dialog UI for this chat yet.
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
      <p className="px-1 pb-1 font-mono text-[11px] text-muted-foreground">{peerId}</p>
      {DIALOG_FIELDS.map((spec) => {
        const value = dialog[spec.key];
        if (spec.kind === 'boolean') {
          return (
            <BooleanField
              key={spec.key}
              label={spec.key}
              onChange={(next) => writeDialogField(dialog, spec.key, next)}
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
                if (trimmed === '') return false;
                const next = Number(trimmed);
                if (!Number.isFinite(next)) return false;
                writeDialogField(dialog, spec.key, next);
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
                if (trimmed === '') return false;
                writeDialogField(dialog, spec.key, trimmed);
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
            lengthHint={`length ${Array.isArray(value) ? value.length : 0}`}
            maxHeight
            onCommit={(raw) => parseJsonField(spec, raw)}
            onWrite={(next) => writeDialogField(dialog, spec.key, next)}
            value={value}
          />
        );
      })}
    </Form>
  );
});
