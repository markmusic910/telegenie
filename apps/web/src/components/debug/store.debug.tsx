'use client';

import { Button } from '@/lib/components/ui/button';
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from '@/lib/components/ui/collapsible';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/lib/components/ui/input-group';
import {
  Popover,
  PopoverClose,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from '@/lib/components/ui/popover';
import { ScrollArea } from '@/lib/components/ui/scroll-area';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/lib/components/ui/tabs';
import { useSDK } from '@/lib/contexts/sdk.context';
import {
  dumpIdbStore,
  getIdbRecord,
  listIdbKeys,
  listIdbStores,
  type IdbStoreRef,
} from '@/lib/debug/idb.dump';
import { cn } from '@/lib/utils';
import {
  type EntityStoreView,
  type FoundationDebugStore,
  type GlobalStoreView,
  MAIN_THREAD_ID,
  messageCacheKey,
} from '@telegenie/sdk';
import { Bug, ChevronRight, Search, XIcon } from 'lucide-react';
import { toJS } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { CurrentDialogUpdateForm } from './store.debug.dialog-form';
import {
  EMPTY_FOUNDATION_ENTITY_IDS,
  FOUNDATION_UTILS,
  FoundationEntityDeleteForm,
  isFoundationDebugStore,
} from './store.debug.foundation-form';
import { CurrentThreadUpdateForm } from './store.debug.thread-form';
import {
  ClearAllStoresForm,
  EntityStoreDeleteForm,
  GlobalStoreDeleteForm,
} from './store.debug.utils-form';

const MESSAGE_STORE_SUFFIX = '-message';
const SDK_IDB_MESSAGE_STORE = 'message';

function isMessageStoreName(name: string): boolean {
  return name.endsWith(MESSAGE_STORE_SUFFIX);
}

function dumpLabel(kind: string, name: string) {
  return `[TeleGenie ${kind}] ${name}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function filterStoreNames(names: string[], query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return names;
  return names.filter((name) => name.toLowerCase().includes(normalized));
}

function compareIds(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

async function loadFoundationEntityIds(
  refs: IdbStoreRef[],
): Promise<typeof EMPTY_FOUNDATION_ENTITY_IDS> {
  const next: typeof EMPTY_FOUNDATION_ENTITY_IDS = {
    chats: [],
    chatFull: [],
    channels: [],
    channelFull: [],
  };
  await Promise.all(
    refs.map(async (ref) => {
      if (!isFoundationDebugStore(ref.storeName)) return;
      try {
        const keys = await listIdbKeys(ref.dbName, ref.storeName);
        next[ref.storeName].push(...keys.map(String));
      } catch (error) {
        console.error(dumpLabel('idb', `${ref.dbName} / ${ref.storeName}`), error);
      }
    }),
  );
  for (const entry of FOUNDATION_UTILS) {
    next[entry.store] = Array.from(new Set(next[entry.store])).sort(compareIds);
  }
  return next;
}

function parseMessageCacheKey(cacheKey: string): { peerId: string; messageId: string } {
  const idx = cacheKey.indexOf(':');
  if (idx === -1) return { peerId: cacheKey, messageId: '' };
  return { peerId: cacheKey.slice(0, idx), messageId: cacheKey.slice(idx + 1) };
}

function groupMessageCacheKeys(keys: string[]): { peerId: string; messageIds: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const key of keys) {
    const { peerId, messageId } = parseMessageCacheKey(key);
    const list = groups.get(peerId);
    if (list) list.push(messageId);
    else groups.set(peerId, [messageId]);
  }
  return Array.from(groups.entries())
    .sort(([left], [right]) => compareIds(left, right))
    .map(([peerId, messageIds]) => ({
      peerId,
      messageIds: messageIds.sort(compareIds),
    }));
}

function filterMessageGroups(
  groups: { peerId: string; messageIds: string[] }[],
  query: string,
): { peerId: string; messageIds: string[] }[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return groups;
  const matched: { peerId: string; messageIds: string[] }[] = [];
  for (const group of groups) {
    const peerMatches = group.peerId.toLowerCase().includes(normalized);
    const messageIds = peerMatches
      ? group.messageIds
      : group.messageIds.filter((id) => id.toLowerCase().includes(normalized));
    if (peerMatches || messageIds.length > 0) {
      matched.push({ peerId: group.peerId, messageIds });
    }
  }
  return matched;
}

const StoreDebugPanel = observer(function StoreDebugPanel() {
  const sdk = useSDK();
  const [open, setOpen] = useState(false);
  const [memoryStores, setMemoryStores] = useState<string[]>([]);
  const [sdkIdbStores, setSdkIdbStores] = useState<IdbStoreRef[]>([]);
  const [idbMessageStores, setIdbMessageStores] = useState<{ ref: IdbStoreRef; keys: string[] }[]>(
    [],
  );
  const [foundationIdbStores, setFoundationIdbStores] = useState<IdbStoreRef[]>([]);
  const [foundationEntityIds, setFoundationEntityIds] = useState(EMPTY_FOUNDATION_ENTITY_IDS);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [entityStoreQuery, setEntityStoreQuery] = useState('');
  const [messageStoreQuery, setMessageStoreQuery] = useState('');
  const [idbMessageQuery, setIdbMessageQuery] = useState('');
  const [globalOpen, setGlobalOpen] = useState(false);
  const [appOpen, setAppOpen] = useState(false);
  const [dialogsOpen, setDialogsOpen] = useState(false);
  const [dialogQuery, setDialogQuery] = useState('');

  const otherSdkStores = useMemo(
    () => sdkIdbStores.filter((ref) => ref.storeName !== SDK_IDB_MESSAGE_STORE),
    [sdkIdbStores],
  );

  const entityStores = useMemo(
    () => memoryStores.filter((name) => !isMessageStoreName(name)),
    [memoryStores],
  );
  const messageStores = useMemo(
    () => memoryStores.filter((name) => isMessageStoreName(name)),
    [memoryStores],
  );
  const filteredEntityStores = useMemo(
    () => filterStoreNames(entityStores, entityStoreQuery),
    [entityStoreQuery, entityStores],
  );
  const filteredMessageStores = useMemo(
    () => filterStoreNames(messageStores, messageStoreQuery),
    [messageStoreQuery, messageStores],
  );

  const refresh = useCallback(async () => {
    const names = sdk.store.names().slice().sort((a, b) => a.localeCompare(b));
    setMemoryStores(names);
    const [sdkStores, foundationStores] = await Promise.all([
      listIdbStores('sdk'),
      listIdbStores('foundation'),
    ]);
    setSdkIdbStores(sdkStores);
    setFoundationIdbStores(foundationStores);
    setFoundationEntityIds(await loadFoundationEntityIds(foundationStores));
    const messageRefs = sdkStores.filter((ref) => ref.storeName === SDK_IDB_MESSAGE_STORE);
    const messageDumps = await Promise.all(
      messageRefs.map(async (ref) => {
        try {
          const keys = await listIdbKeys(ref.dbName, ref.storeName);
          return { ref, keys: keys.map(String).sort(compareIds) };
        } catch (error) {
          console.error(dumpLabel('idb', `${ref.dbName} / ${ref.storeName}`), error);
          return { ref, keys: [] as string[] };
        }
      }),
    );
    setIdbMessageStores(messageDumps);
  }, [sdk.store]);

  const handleOpenChange = useCallback(
    (next: boolean, eventDetails: { reason: string; cancel: () => void }) => {
      if (!next && eventDetails.reason !== 'close-press') {
        eventDetails.cancel();
        return;
      }
      setOpen(next);
      if (next) void refresh();
    },
    [refresh],
  );

  const printMemoryStore = useCallback(
    (name: string) => {
      const store = sdk.store.get(name);
      const value =
        store && typeof store.toJS === 'function' ? store.toJS() : toJS(store);
      console.log(dumpLabel('sdk memory', name), value);
    },
    [sdk.store],
  );

  const printMemoryEntity = useCallback(
    (name: string, id: string) => {
      const store = sdk.store.get(name) as EntityStoreView<unknown>;
      console.log(dumpLabel('sdk memory', `${name}.${id}`), toJS(store.get(id)));
    },
    [sdk.store],
  );

  const printGlobalPath = useCallback(
    (path: string, value: unknown) => {
      console.log(dumpLabel('sdk memory', `global.${path}`), value);
    },
    [],
  );

  const printCurrentDialog = useCallback(() => {
    const peerId = sdk.globalStore.nav.selectedDialogId;
    if (!peerId) {
      console.log(dumpLabel('sdk utils', 'current dialog'), { peerId: null });
      return;
    }
    const dialogUI = sdk.globalStore.getDialogUI(peerId);
    console.log(dumpLabel('sdk utils', 'current dialog'), {
      peerId,
      dialogUI: dialogUI ? toJS(dialogUI) : undefined,
    });
  }, [sdk.globalStore]);

  const printCurrentThread = useCallback(() => {
    const peerId = sdk.globalStore.nav.selectedDialogId;
    if (!peerId) {
      console.log(dumpLabel('sdk utils', 'current thread'), { peerId: null });
      return;
    }
    const threadId =
      sdk.globalStore.getDialogUI(peerId)?.activeThreadId ?? MAIN_THREAD_ID;
    const threadUI = sdk.globalStore.getThreadUI(peerId, threadId);
    console.log(dumpLabel('sdk utils', 'current thread'), {
      peerId,
      threadId,
      threadUI: threadUI ? toJS(threadUI) : undefined,
    });
  }, [sdk.globalStore]);

  const printFoundationEntity = useCallback(
    async (store: FoundationDebugStore, id: string) => {
      const label = dumpLabel('foundation utils', `${store}.${id}`);
      const refs = foundationIdbStores.filter((ref) => ref.storeName === store);
      if (refs.length === 0) {
        console.log(label, undefined);
        return;
      }
      try {
        const rows = await Promise.all(
          refs.map(async (ref) => getIdbRecord(ref.dbName, ref.storeName, id)),
        );
        console.log(label, rows.length === 1 ? rows[0] : rows);
      } catch (error) {
        console.error(label, error);
      }
    },
    [foundationIdbStores],
  );

  const printIdbStore = useCallback(async (ref: IdbStoreRef, cacheKeys?: string[]) => {
    const label =
      cacheKeys?.length === 1
        ? `${ref.dbName} / ${ref.storeName} / ${cacheKeys[0]}`
        : `${ref.dbName} / ${ref.storeName}`;
    setBusyKey(`${ref.dbName}:${ref.storeName}${cacheKeys?.length === 1 ? `:${cacheKeys[0]}` : ''}`);
    try {
      if (cacheKeys?.length === 1) {
        const row = await getIdbRecord(ref.dbName, ref.storeName, cacheKeys[0]);
        console.log(dumpLabel('idb', label), row);
        return;
      }
      if (cacheKeys && cacheKeys.length === 0) {
        console.log(dumpLabel('idb', label), { count: 0, rows: [] });
        return;
      }
      const rows = await dumpIdbStore(ref.dbName, ref.storeName);
      const filtered = cacheKeys
        ? rows.filter((row) => isRecord(row) && cacheKeys.includes(String(row.cacheKey)))
        : rows;
      console.log(dumpLabel('idb', label), {
        count: filtered.length,
        rows: filtered,
      });
    } catch (error) {
      console.error(dumpLabel('idb', label), error);
    } finally {
      setBusyKey(null);
    }
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50">
      <Popover onOpenChange={handleOpenChange} open={open}>
        <PopoverTrigger
          render={
            <Button
              aria-label="Open store debugger"
              className="pointer-events-auto shadow-lg"
              size="icon-lg"
              variant="outline"
            />
          }
        >
          <Bug aria-hidden="true" />
        </PopoverTrigger>
        <PopoverPopup
          align="end"
          className="pointer-events-auto w-[32rem]"
          side="top"
          sideOffset={8}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <PopoverTitle className="text-sm">Store debugger</PopoverTitle>
              <div className="flex items-center gap-1">
                <Button onClick={() => void refresh()} size="xs" variant="ghost">
                  Refresh
                </Button>
                <PopoverClose
                  aria-label="Close store debugger"
                  render={<Button size="icon-xs" variant="ghost" />}
                >
                  <XIcon />
                </PopoverClose>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Print snapshots, patch the current dialog or thread UI, or delete cache entries.
            </p>
            <Tabs defaultValue="sdk">
              <TabsList className="w-full">
                <TabsTab className="flex-1" value="sdk">
                  SDK
                </TabsTab>
                <TabsTab className="flex-1" value="foundation">
                  Foundation
                </TabsTab>
              </TabsList>
              <TabsPanel className="mt-3" value="sdk">
                <Tabs defaultValue="utils">
                  <TabsList className="w-full">
                    <TabsTab className="flex-1 px-1.5" value="utils">
                      Utils
                    </TabsTab>
                    <TabsTab className="flex-1 px-1.5" value="memory">
                      Memory
                    </TabsTab>
                    <TabsTab className="flex-1 px-1.5" value="idb">
                      IndexedDB
                    </TabsTab>
                  </TabsList>
                  <TabsPanel className="mt-3" value="utils">
                    <ScrollArea className="h-[32rem]">
                      <div className="flex flex-col">
                        <DebugItem label="current dialog" onClick={printCurrentDialog} />
                        <DebugItem label="current thread" onClick={printCurrentThread} />
                        <DebugSection title="clear all stores">
                          <ClearAllStoresForm onCleared={() => void refresh()} />
                        </DebugSection>
                        <DebugSection title="delete entity store">
                          <EntityStoreDeleteForm
                            storeNames={[
                              ...entityStores.filter((name) => name !== 'global'),
                              ...messageStores,
                            ]}
                          />
                        </DebugSection>
                        <DebugSection title="delete global dialog / thread">
                          <GlobalStoreDeleteForm />
                        </DebugSection>
                        <DebugSection title="current dialog update">
                          <CurrentDialogUpdateForm />
                        </DebugSection>
                        <DebugSection title="current thread update">
                          <CurrentThreadUpdateForm />
                        </DebugSection>
                      </div>
                    </ScrollArea>
                  </TabsPanel>
                  <TabsPanel className="mt-3" value="memory">
                    <ScrollArea className="h-[32rem]">
                      <div className="flex flex-col">
                        <FilterableStoreList
                          emptyText="No stores in memory yet."
                          names={filteredEntityStores}
                          noMatchText="No stores match the search."
                          onQueryChange={setEntityStoreQuery}
                          query={entityStoreQuery}
                          searchLabel="Search entity stores"
                          searchPlaceholder="Search store name"
                          totalCount={entityStores.length}
                        >
                          {(name) =>
                            name === 'global' ? (
                              <GlobalStoreSection
                                appOpen={appOpen}
                                dialogQuery={dialogQuery}
                                dialogsOpen={dialogsOpen}
                                globalStore={sdk.globalStore}
                                key={name}
                                onAppOpenChange={setAppOpen}
                                onDialogQueryChange={setDialogQuery}
                                onDialogsOpenChange={setDialogsOpen}
                                onOpenChange={setGlobalOpen}
                                onPrintPath={printGlobalPath}
                                open={globalOpen}
                              />
                            ) : (
                              <EntityStoreSection
                                key={name}
                                name={name}
                                onPrintEntity={(id) => printMemoryEntity(name, id)}
                                onPrintStore={() => printMemoryStore(name)}
                                store={sdk.store.get(name) as EntityStoreView<unknown>}
                              />
                            )
                          }
                        </FilterableStoreList>
                        <div className="mt-3">
                          <DebugSection title="messages">
                            <FilterableStoreList
                              emptyText="No message stores in memory yet."
                              names={filteredMessageStores}
                              noMatchText="No message stores match the search."
                              onQueryChange={setMessageStoreQuery}
                              query={messageStoreQuery}
                              searchLabel="Search message stores"
                              searchPlaceholder="Search peer id"
                              totalCount={messageStores.length}
                            >
                              {(name) => (
                                <DebugItem
                                  key={name}
                                  label={name}
                                  onClick={() => printMemoryStore(name)}
                                />
                              )}
                            </FilterableStoreList>
                          </DebugSection>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsPanel>
                  <TabsPanel className="mt-3" value="idb">
                    <ScrollArea className="h-[32rem]">
                      {sdkIdbStores.length === 0 ? (
                        <EmptyHint text="No SDK cache databases." />
                      ) : (
                        <div className="flex flex-col">
                          {otherSdkStores.map((ref) => (
                            <DebugItem
                              busy={busyKey === `${ref.dbName}:${ref.storeName}`}
                              key={`${ref.dbName}:${ref.storeName}`}
                              label={ref.storeName}
                              onClick={() => void printIdbStore(ref)}
                              subtitle={ref.dbName}
                            />
                          ))}
                          <div className={otherSdkStores.length > 0 ? 'mt-3' : undefined}>
                            <DebugSection title="message">
                              <IdbMessageStoreList
                                busyKey={busyKey}
                                entries={idbMessageStores}
                                onPrint={printIdbStore}
                                onQueryChange={setIdbMessageQuery}
                                query={idbMessageQuery}
                              />
                            </DebugSection>
                          </div>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsPanel>
                </Tabs>
              </TabsPanel>
              <TabsPanel className="mt-3" value="foundation">
                <Tabs defaultValue="utils">
                  <TabsList className="w-full">
                    <TabsTab className="flex-1 px-1.5" value="utils">
                      Utils
                    </TabsTab>
                    <TabsTab className="flex-1 px-1.5" value="idb">
                      IndexedDB
                    </TabsTab>
                  </TabsList>
                  <TabsPanel className="mt-3" value="utils">
                    <ScrollArea className="h-[32rem]">
                      <div className="flex flex-col">
                        {FOUNDATION_UTILS.map(({ store, title }) => (
                          <DebugSection key={store} title={title}>
                            <FoundationEntityDeleteForm
                              ids={foundationEntityIds[store]}
                              onDeleted={() => void refresh()}
                              onSelect={(id) => void printFoundationEntity(store, id)}
                              store={store}
                            />
                          </DebugSection>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsPanel>
                  <TabsPanel className="mt-3" value="idb">
                    <ScrollArea className="h-[32rem]">
                      {foundationIdbStores.length === 0 ? (
                        <EmptyHint text="No foundation databases." />
                      ) : (
                        <div className="flex flex-col">
                          {foundationIdbStores.map((ref) => (
                            <DebugItem
                              busy={busyKey === `${ref.dbName}:${ref.storeName}`}
                              key={`${ref.dbName}:${ref.storeName}`}
                              label={ref.storeName}
                              onClick={() => void printIdbStore(ref)}
                              subtitle={ref.dbName}
                            />
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsPanel>
                </Tabs>
              </TabsPanel>
            </Tabs>
          </div>
        </PopoverPopup>
      </Popover>
    </div>
  );
});

function DebugSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1">
      <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function DebugChevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      aria-hidden="true"
      className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
    />
  );
}

function DebugSearchInput({
  label,
  placeholder,
  query,
  onQueryChange,
}: {
  label: string;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  return (
    <InputGroup className="mb-1">
      <InputGroupAddon>
        <Search aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={label}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
        size="sm"
        type="search"
        value={query}
      />
    </InputGroup>
  );
}

const GlobalStoreSection = observer(function GlobalStoreSection({
  globalStore,
  open,
  appOpen,
  dialogsOpen,
  dialogQuery,
  onOpenChange,
  onAppOpenChange,
  onDialogsOpenChange,
  onDialogQueryChange,
  onPrintPath,
}: {
  globalStore: GlobalStoreView;
  open: boolean;
  appOpen: boolean;
  dialogsOpen: boolean;
  dialogQuery: string;
  onOpenChange: (open: boolean) => void;
  onAppOpenChange: (open: boolean) => void;
  onDialogsOpenChange: (open: boolean) => void;
  onDialogQueryChange: (query: string) => void;
  onPrintPath: (path: string, value: unknown) => void;
}) {
  const snapshot = globalStore.toJS();
  const app: Record<string, unknown> = isRecord(snapshot.app) ? snapshot.app : {};
  const appKeys = Object.keys(app)
    .filter((key) => key !== 'dialogs')
    .sort((a, b) => a.localeCompare(b));
  const dialogs: Record<string, unknown> = isRecord(app.dialogs) ? app.dialogs : {};
  const dialogIds = Object.keys(dialogs).sort((a, b) => a.localeCompare(b));
  const query = dialogQuery.trim().toLowerCase();
  const filteredDialogIds = query
    ? dialogIds.filter((id) => id.toLowerCase().includes(query))
    : dialogIds;

  return (
    <Collapsible onOpenChange={onOpenChange} open={open}>
      <CollapsibleTrigger className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-left hover:bg-accent">
        <DebugChevron open={open} />
        <span className="truncate font-mono text-xs text-foreground">global</span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="ml-3 flex flex-col border-l border-border/60 pl-1">
          <DebugItem
            label="auth"
            onClick={() => onPrintPath('auth', globalStore.toJS().auth)}
          />
          <Collapsible onOpenChange={onAppOpenChange} open={appOpen}>
            <CollapsibleTrigger className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-left hover:bg-accent">
              <DebugChevron open={appOpen} />
              <span className="truncate font-mono text-xs text-foreground">app</span>
            </CollapsibleTrigger>
            <CollapsiblePanel>
              <div className="ml-3 flex flex-col border-l border-border/60 pl-1">
                {appKeys.map((key) => (
                  <DebugItem
                    key={key}
                    label={key}
                    onClick={() => {
                      const latestApp = globalStore.toJS().app;
                      onPrintPath(`app.${key}`, isRecord(latestApp) ? latestApp[key] : undefined);
                    }}
                  />
                ))}
                <Collapsible onOpenChange={onDialogsOpenChange} open={dialogsOpen}>
                  <CollapsibleTrigger className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-left hover:bg-accent">
                    <DebugChevron open={dialogsOpen} />
                    <span className="truncate font-mono text-xs text-foreground">dialogs</span>
                    <span className="text-[11px] text-muted-foreground">({dialogIds.length})</span>
                  </CollapsibleTrigger>
                  <CollapsiblePanel>
                    <div className="flex flex-col gap-1 pt-1">
                      <DebugSearchInput
                        label="Search dialogs"
                        onQueryChange={onDialogQueryChange}
                        placeholder="Search peer id"
                        query={dialogQuery}
                      />
                      {dialogIds.length === 0 ? (
                        <EmptyHint text="No dialog UI state yet." />
                      ) : filteredDialogIds.length === 0 ? (
                        <EmptyHint text="No dialogs match the search." />
                      ) : (
                        filteredDialogIds.map((peerId) => (
                          <DebugItem
                            key={peerId}
                            label={peerId}
                            onClick={() => {
                              const latestApp = globalStore.toJS().app;
                              const latestDialogs = isRecord(latestApp) && isRecord(latestApp.dialogs)
                                ? latestApp.dialogs
                                : {};
                              onPrintPath(`app.dialogs.${peerId}`, latestDialogs[peerId]);
                            }}
                          />
                        ))
                      )}
                    </div>
                  </CollapsiblePanel>
                </Collapsible>
              </div>
            </CollapsiblePanel>
          </Collapsible>
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
});

const EntityStoreSection = observer(function EntityStoreSection({
  name,
  store,
  onPrintStore,
  onPrintEntity,
}: {
  name: string;
  store: EntityStoreView<unknown>;
  onPrintStore: () => void;
  onPrintEntity: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ids = Array.from(store.getAllData().keys(), String).sort((a, b) => a.localeCompare(b));
  const filteredIds = filterStoreNames(ids, query);

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <CollapsibleTrigger className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-left hover:bg-accent">
        <DebugChevron open={open} />
        <span className="truncate font-mono text-xs text-foreground">{name}</span>
        <span className="text-[11px] text-muted-foreground">({ids.length})</span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="ml-3 flex flex-col gap-1 border-l border-border/60 pt-1 pl-1">
          <DebugItem label="print all" onClick={onPrintStore} />
          <DebugSearchInput
            label={`Search ${name} ids`}
            onQueryChange={setQuery}
            placeholder="Search id"
            query={query}
          />
          {ids.length === 0 ? (
            <EmptyHint text={`No ${name} entities yet.`} />
          ) : filteredIds.length === 0 ? (
            <EmptyHint text="No ids match the search." />
          ) : (
            filteredIds.map((id) => (
              <DebugItem key={id} label={id} onClick={() => onPrintEntity(id)} />
            ))
          )}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
});

function FilterableStoreList({
  names,
  totalCount,
  query,
  searchLabel,
  searchPlaceholder,
  emptyText,
  noMatchText,
  onQueryChange,
  children,
}: {
  names: string[];
  totalCount: number;
  query: string;
  searchLabel: string;
  searchPlaceholder: string;
  emptyText: string;
  noMatchText: string;
  onQueryChange: (query: string) => void;
  children: (name: string) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <DebugSearchInput
        label={searchLabel}
        onQueryChange={onQueryChange}
        placeholder={searchPlaceholder}
        query={query}
      />
      {totalCount === 0 ? (
        <EmptyHint text={emptyText} />
      ) : names.length === 0 ? (
        <EmptyHint text={noMatchText} />
      ) : (
        names.map((name) => children(name))
      )}
    </div>
  );
}

function IdbMessageStoreList({
  entries,
  query,
  busyKey,
  onQueryChange,
  onPrint,
}: {
  entries: { ref: IdbStoreRef; keys: string[] }[];
  query: string;
  busyKey: string | null;
  onQueryChange: (query: string) => void;
  onPrint: (ref: IdbStoreRef, cacheKeys?: string[]) => void;
}) {
  const totalCount = entries.reduce((sum, entry) => sum + entry.keys.length, 0);
  const filtered = entries.map((entry) => ({
    ref: entry.ref,
    groups: filterMessageGroups(groupMessageCacheKeys(entry.keys), query),
  }));
  const matchCount = filtered.reduce(
    (sum, entry) => sum + entry.groups.reduce((groupSum, group) => groupSum + group.messageIds.length, 0),
    0,
  );
  const hasQuery = Boolean(query.trim());

  return (
    <div className="flex flex-col gap-1">
      <DebugSearchInput
        label="Search cached messages"
        onQueryChange={onQueryChange}
        placeholder="Search peer id or message id"
        query={query}
      />
      {entries.length === 0 || totalCount === 0 ? (
        <EmptyHint text="No cached messages." />
      ) : matchCount === 0 ? (
        <EmptyHint text="No messages match the search." />
      ) : (
        filtered
          .filter(({ groups }) => groups.length > 0)
          .map(({ ref, groups }) => {
          const visibleKeys = groups.flatMap((group) =>
            group.messageIds.map((messageId) => messageCacheKey(group.peerId, messageId)),
          );
          return (
            <div className="flex flex-col" key={`${ref.dbName}:${ref.storeName}`}>
              {entries.length > 1 ? (
                <p className="px-1 pt-1 font-mono text-[10px] text-muted-foreground">{ref.dbName}</p>
              ) : null}
              <DebugItem
                busy={busyKey === `${ref.dbName}:${ref.storeName}`}
                label={hasQuery ? `print matching (${visibleKeys.length})` : 'print all'}
                onClick={() => onPrint(ref, hasQuery ? visibleKeys : undefined)}
              />
              {groups.map((group) => (
                <IdbMessagePeerSection
                  busyKey={busyKey}
                  dbName={ref.dbName}
                  forceOpen={hasQuery}
                  key={`${ref.dbName}:${group.peerId}`}
                  messageIds={group.messageIds}
                  onPrintMessage={(messageId) =>
                    onPrint(ref, [messageCacheKey(group.peerId, messageId)])
                  }
                  onPrintPeer={() =>
                    onPrint(
                      ref,
                      group.messageIds.map((messageId) => messageCacheKey(group.peerId, messageId)),
                    )
                  }
                  peerId={group.peerId}
                  storeName={ref.storeName}
                />
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}

function IdbMessagePeerSection({
  peerId,
  messageIds,
  dbName,
  storeName,
  busyKey,
  forceOpen,
  onPrintPeer,
  onPrintMessage,
}: {
  peerId: string;
  messageIds: string[];
  dbName: string;
  storeName: string;
  busyKey: string | null;
  forceOpen: boolean;
  onPrintPeer: () => void;
  onPrintMessage: (messageId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const expanded = forceOpen || open;

  return (
    <Collapsible onOpenChange={setOpen} open={expanded}>
      <CollapsibleTrigger className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-left hover:bg-accent">
        <DebugChevron open={expanded} />
        <span className="truncate font-mono text-xs text-foreground">{peerId}</span>
        <span className="text-[11px] text-muted-foreground">({messageIds.length})</span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="ml-3 flex flex-col gap-1 border-l border-border/60 pt-1 pl-1">
          <DebugItem
            busy={busyKey === `${dbName}:${storeName}`}
            label="print all"
            onClick={onPrintPeer}
          />
          {messageIds.map((messageId) => (
            <DebugItem
              busy={busyKey === `${dbName}:${storeName}:${messageCacheKey(peerId, messageId)}`}
              key={messageId}
              label={messageId}
              onClick={() => onPrintMessage(messageId)}
            />
          ))}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="px-1 py-2 text-xs text-muted-foreground">{text}</p>;
}

function DebugItem({
  label,
  subtitle,
  busy,
  onClick,
}: {
  label: string;
  subtitle?: string;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-accent"
      disabled={busy}
      onClick={onClick}
      type="button"
    >
      <span className="truncate font-mono text-xs text-foreground">{label}</span>
      {subtitle ? (
        <span className="truncate font-mono text-[10px] text-muted-foreground">{subtitle}</span>
      ) : null}
    </button>
  );
}

export default StoreDebugPanel;
