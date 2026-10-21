'use client';

import { Button } from '@/lib/components/ui/button';
import { Field, FieldLabel } from '@/lib/components/ui/field';
import { Input } from '@/lib/components/ui/input';
import { useSDK } from '@/lib/contexts/sdk.context';
import type { FoundationDebugStore } from '@telegenie/sdk';
import { useState } from 'react';

export const FOUNDATION_UTILS: { store: FoundationDebugStore; title: string }[] = [
  { store: 'chats', title: 'chat' },
  { store: 'chatFull', title: 'chatFull' },
  { store: 'channels', title: 'channel' },
  { store: 'channelFull', title: 'channelFull' },
];

export const EMPTY_FOUNDATION_ENTITY_IDS: Record<FoundationDebugStore, string[]> = {
  chats: [],
  chatFull: [],
  channels: [],
  channelFull: [],
};

export function isFoundationDebugStore(name: string): name is FoundationDebugStore {
  return FOUNDATION_UTILS.some((entry) => entry.store === name);
}

function dumpLabel(kind: string, name: string) {
  return `[TeleGenie ${kind}] ${name}`;
}

function filterIds(ids: string[], query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return ids;
  return ids.filter((id) => id.toLowerCase().includes(normalized));
}

export function FoundationEntityDeleteForm({
  store,
  ids,
  onSelect,
  onDeleted,
}: {
  store: FoundationDebugStore;
  ids: string[];
  onSelect?: (id: string) => void;
  onDeleted?: () => void;
}) {
  const sdk = useSDK();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const trimmed = query.trim();
  const exact = ids.includes(trimmed);
  const filtered = filterIds(ids, query);
  const listId = `foundation-delete-${store}-ids`;

  const selectId = (id: string) => {
    setQuery(id);
    if (!ids.includes(id)) return;
    onSelect?.(id);
  };

  const run = async () => {
    if (!exact) return;
    setBusy(true);
    try {
      await sdk.debugDeleteFoundationEntity(store, trimmed);
      console.log(dumpLabel('foundation utils', `delete ${store}`), { store, id: trimmed });
      setQuery('');
      onDeleted?.();
    } catch (error) {
      console.error(dumpLabel('foundation utils', `delete ${store}`), error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 px-1 py-1">
      <p className="text-[11px] text-muted-foreground">
        Select an id to print that row. Delete removes it, and the in-memory store drops it with the entity change.
      </p>
      <Field className="flex-row items-center justify-between gap-2 py-0.5">
        <FieldLabel className="w-[5.5rem] shrink-0 truncate font-mono text-[11px]" title="id">
          id
        </FieldLabel>
        <div className="min-w-0 flex-1">
          <Input
            aria-invalid={trimmed !== '' && !exact ? true : undefined}
            list={listId}
            nativeInput
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              const id = next.trim();
              if (ids.includes(id)) selectId(id);
            }}
            placeholder={ids.length === 0 ? 'No ids stored' : 'Search or enter id'}
            size="sm"
            type="search"
            value={query}
          />
          <datalist id={listId}>
            {filtered.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
        </div>
      </Field>
      {trimmed && !exact ? (
        <div className="flex max-h-32 flex-col overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-1 py-1 text-xs text-muted-foreground">No ids match the search.</p>
          ) : (
            <>
              {filtered.slice(0, 50).map((id) => (
                <button
                  className="truncate rounded-md px-2 py-1 text-left font-mono text-xs text-foreground hover:bg-accent"
                  key={id}
                  onClick={() => selectId(id)}
                  type="button"
                >
                  {id}
                </button>
              ))}
              {filtered.length > 50 ? (
                <p className="px-2 py-1 text-[10px] text-muted-foreground">
                  Showing 50 of {filtered.length}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      <IdHint count={ids.length} matchCount={trimmed ? filtered.length : ids.length} />
      <div className="flex flex-wrap justify-end gap-1 pt-1">
        <Button
          disabled={!exact || busy}
          onClick={() => void run()}
          size="xs"
          type="button"
          variant="destructive"
        >
          {busy ? 'Deleting…' : 'Delete'}
        </Button>
      </div>
    </div>
  );
}

function IdHint({ count, matchCount }: { count: number; matchCount: number }) {
  let text = `${count} stored`;
  if (count > 0 && matchCount !== count) text = `${matchCount} match · ${count} stored`;
  return <p className="px-1 font-mono text-[10px] text-muted-foreground">{text}</p>;
}
