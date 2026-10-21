'use client';

import { Button } from '@/lib/components/ui/button';
import { Field, FieldLabel } from '@/lib/components/ui/field';
import { Input } from '@/lib/components/ui/input';
import { useSDK } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import { MAIN_THREAD_ID, type EntityStoreView } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';
import { useState, type ReactNode } from 'react';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dumpLabel(kind: string, name: string) {
  return `[TeleGenie ${kind}] ${name}`;
}

function filterIds(ids: string[], query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return ids;
  return ids.filter((id) => id.toLowerCase().includes(normalized));
}

export const ClearAllStoresForm = observer(function ClearAllStoresForm({
  onCleared,
}: {
  onCleared?: () => void;
}) {
  const sdk = useSDK();
  const [busy, setBusy] = useState<'memory' | 'idb' | 'both' | null>(null);

  const run = async (target: 'memory' | 'idb' | 'both') => {
    setBusy(target);
    try {
      await sdk.debugClearAllStores(target);
      console.log(dumpLabel('sdk utils', `clear all ${target}`), { target });
      onCleared?.();
    } catch (error) {
      console.error(dumpLabel('sdk utils', `clear all ${target}`), error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 px-1 py-1">
      <p className="text-[11px] text-muted-foreground">
        Memory: entity stores and thread UI. IDB: SDK cache (dialog, dialogFilter, message,
        global). Auth and nav stay.
      </p>
      <div className="flex flex-wrap justify-end gap-1 pt-1">
        <Button
          disabled={busy !== null}
          onClick={() => void run('memory')}
          size="xs"
          type="button"
          variant="destructive-outline"
        >
          {busy === 'memory' ? 'Clearing…' : 'Clear memory'}
        </Button>
        <Button
          disabled={busy !== null}
          onClick={() => void run('idb')}
          size="xs"
          type="button"
          variant="destructive-outline"
        >
          {busy === 'idb' ? 'Clearing…' : 'Clear IDB'}
        </Button>
        <Button
          disabled={busy !== null}
          onClick={() => void run('both')}
          size="xs"
          type="button"
          variant="destructive"
        >
          {busy === 'both' ? 'Clearing…' : 'Clear both'}
        </Button>
      </div>
    </div>
  );
});

export const EntityStoreDeleteForm = observer(function EntityStoreDeleteForm({
  storeNames,
}: {
  storeNames: string[];
}) {
  const sdk = useSDK();
  const [storeName, setStoreName] = useState(storeNames[0] ?? '');
  const [entityId, setEntityId] = useState('');
  const [busy, setBusy] = useState<'entity' | 'store' | null>(null);

  const selectedStore = storeNames.includes(storeName) ? storeName : (storeNames[0] ?? '');
  const store = selectedStore
    ? (sdk.store.get(selectedStore) as EntityStoreView<unknown> | undefined)
    : undefined;
  const ids =
    store && typeof store.getAllData === 'function'
      ? Array.from(store.getAllData().keys(), String).sort((a, b) => a.localeCompare(b))
      : [];
  const trimmedId = entityId.trim();

  const run = async (action: 'entity' | 'store', work: () => Promise<void>, payload: unknown) => {
    setBusy(action);
    try {
      await work();
      if (action === 'entity') setEntityId('');
      console.log(
        dumpLabel('sdk utils', action === 'entity' ? 'delete entity' : 'delete store'),
        payload,
      );
    } catch (error) {
      console.error(
        dumpLabel('sdk utils', action === 'entity' ? 'delete entity' : 'delete store'),
        error,
      );
    } finally {
      setBusy(null);
    }
  };

  if (storeNames.length === 0) {
    return (
      <p className="px-1 py-2 text-xs text-muted-foreground">No entity stores in memory yet.</p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 px-1 py-1">
      <p className="text-[11px] text-muted-foreground">
        Memory always. SDK IDB only for dialog, dialogFilter, and per-peer message stores.
      </p>
      <DebugField label="store">
        <DebugNativeSelect
          onChange={(value) => {
            setStoreName(value);
            setEntityId('');
          }}
          options={storeNames}
          value={selectedStore}
        />
      </DebugField>
      <DebugField label="entity id">
        <Input
          list={`${selectedStore}-entity-ids`}
          nativeInput
          onChange={(event) => setEntityId(event.target.value)}
          placeholder="id"
          size="sm"
          value={entityId}
        />
        <datalist id={`${selectedStore}-entity-ids`}>
          {ids.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      </DebugField>
      <div className="flex flex-wrap justify-end gap-1 pt-1">
        <Button
          disabled={!selectedStore || !trimmedId || busy !== null}
          onClick={() =>
            void run('entity', () => sdk.debugDeleteEntity(selectedStore, trimmedId), {
              store: selectedStore,
              id: trimmedId,
            })
          }
          size="xs"
          type="button"
          variant="destructive-outline"
        >
          {busy === 'entity' ? 'Deleting…' : 'Delete entity'}
        </Button>
        <Button
          disabled={!selectedStore || busy !== null}
          onClick={() =>
            void run('store', () => sdk.debugClearEntityStore(selectedStore), {
              store: selectedStore,
            })
          }
          size="xs"
          type="button"
          variant="destructive"
        >
          {busy === 'store' ? 'Deleting…' : 'Delete store'}
        </Button>
      </div>
    </div>
  );
});

export const GlobalStoreDeleteForm = observer(function GlobalStoreDeleteForm() {
  const sdk = useSDK();
  const [dialogQuery, setDialogQuery] = useState('');
  const [threadQuery, setThreadQuery] = useState('');
  const [busy, setBusy] = useState<'dialog' | 'thread' | null>(null);

  const snapshot = sdk.globalStore.toJS();
  const dialogs: Record<string, unknown> =
    isRecord(snapshot.app) && isRecord(snapshot.app.dialogs) ? snapshot.app.dialogs : {};
  const dialogIds = Object.keys(dialogs).sort((a, b) => a.localeCompare(b));
  const selectedPeerId = sdk.globalStore.nav.selectedDialogId;
  const trimmedDialogQuery = dialogQuery.trim();
  const resolvedPeerId = dialogIds.includes(trimmedDialogQuery)
    ? trimmedDialogQuery
    : !trimmedDialogQuery
      ? selectedPeerId && dialogIds.includes(selectedPeerId)
        ? selectedPeerId
        : (dialogIds[0] ?? '')
      : '';
  const dialogQueryValid = !trimmedDialogQuery || dialogIds.includes(trimmedDialogQuery);
  const filteredDialogIds = filterIds(dialogIds, dialogQuery);

  const selectedDialog = isRecord(dialogs[resolvedPeerId]) ? dialogs[resolvedPeerId] : undefined;
  const threads = isRecord(selectedDialog?.threads) ? selectedDialog.threads : {};
  const threadIds = Object.keys(threads).sort((a, b) => a.localeCompare(b));
  const activeThreadId =
    typeof selectedDialog?.activeThreadId === 'string'
      ? selectedDialog.activeThreadId
      : MAIN_THREAD_ID;
  const trimmedThreadQuery = threadQuery.trim();
  const resolvedThreadId = threadIds.includes(trimmedThreadQuery)
    ? trimmedThreadQuery
    : !trimmedThreadQuery
      ? threadIds.includes(activeThreadId)
        ? activeThreadId
        : (threadIds[0] ?? '')
      : '';
  const threadQueryValid = !trimmedThreadQuery || threadIds.includes(trimmedThreadQuery);
  const filteredThreadIds = filterIds(threadIds, threadQuery);

  const run = async (action: 'dialog' | 'thread', work: () => Promise<void>, payload: unknown) => {
    setBusy(action);
    try {
      await work();
      console.log(
        dumpLabel('sdk utils', action === 'dialog' ? 'delete dialog UI' : 'delete thread UI'),
        payload,
      );
    } catch (error) {
      console.error(
        dumpLabel('sdk utils', action === 'dialog' ? 'delete dialog UI' : 'delete thread UI'),
        error,
      );
    } finally {
      setBusy(null);
    }
  };

  if (dialogIds.length === 0) {
    return <p className="px-1 py-2 text-xs text-muted-foreground">No dialog UI state yet.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5 px-1 py-1">
      <DebugField label="dialog">
        <Input
          aria-invalid={dialogQueryValid ? undefined : true}
          list="global-delete-dialog-ids"
          nativeInput
          onChange={(event) => {
            setDialogQuery(event.target.value);
            setThreadQuery('');
          }}
          placeholder="Search or enter peer id"
          size="sm"
          type="search"
          value={dialogQuery}
        />
        <datalist id="global-delete-dialog-ids">
          {filteredDialogIds.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      </DebugField>
      <DebugField label="thread">
        <Input
          aria-invalid={threadQueryValid ? undefined : true}
          disabled={!resolvedPeerId || threadIds.length === 0}
          list="global-delete-thread-ids"
          nativeInput
          onChange={(event) => setThreadQuery(event.target.value)}
          placeholder={threadIds.length === 0 ? 'No threads' : 'Search or enter thread id'}
          size="sm"
          type="search"
          value={threadQuery}
        />
        <datalist id="global-delete-thread-ids">
          {filteredThreadIds.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      </DebugField>
      <div className="flex flex-wrap justify-end gap-1 pt-1">
        <Button
          disabled={
            !resolvedPeerId ||
            !resolvedThreadId ||
            !dialogQueryValid ||
            !threadQueryValid ||
            busy !== null
          }
          onClick={() =>
            void run('thread', () => sdk.debugDeleteThreadUI(resolvedPeerId, resolvedThreadId), {
              peerId: resolvedPeerId,
              threadId: resolvedThreadId,
            })
          }
          size="xs"
          type="button"
          variant="destructive-outline"
        >
          {busy === 'thread' ? 'Deleting…' : 'Delete thread'}
        </Button>
        <Button
          disabled={!resolvedPeerId || !dialogQueryValid || busy !== null}
          onClick={() =>
            void run('dialog', () => sdk.debugDeleteDialogUI(resolvedPeerId), {
              peerId: resolvedPeerId,
            })
          }
          size="xs"
          type="button"
          variant="destructive"
        >
          {busy === 'dialog' ? 'Deleting…' : 'Delete dialog'}
        </Button>
      </div>
    </div>
  );
});

function DebugField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Field className="flex-row items-center justify-between gap-2 py-0.5">
      <FieldLabel className="w-[5.5rem] shrink-0 truncate font-mono text-[11px]" title={label}>
        {label}
      </FieldLabel>
      <div className="min-w-0 flex-1">{children}</div>
    </Field>
  );
}

function DebugNativeSelect({
  value,
  options,
  onChange,
  emptyLabel = 'Select…',
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  emptyLabel?: string;
}) {
  return (
    <select
      className={cn(
        'h-7 w-full min-w-0 rounded-md border border-input bg-background px-2 font-mono text-xs text-foreground outline-none',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24',
      )}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {value ? null : (
        <option disabled value="">
          {emptyLabel}
        </option>
      )}
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
