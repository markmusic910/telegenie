# Architectural and Component Guidelines

## Package Manager

- Always use **Yarn** (`yarn`). Do **not** use `pnpm` or `npm`.
- Common commands:
  - Typecheck: `yarn workspace @telegenie/web typecheck` (or `yarn typecheck` from root)
  - Tests: `yarn test` or `yarn workspace <workspace> test`
  - Build: `yarn build`
  - Dev: `yarn dev`

## Verification

- Do **not** auto-open or drive a browser to verify UI, layout, or user flows.
- After a UI change, stop at code + tests (or the closest non-browser substitute). The human verifies in their own session.

## Component Naming
- All React components MUST use the naming convention: `[use-case-in-kebab-case].[component type, e.g. page or form or button].tsx` (e.g. `auth.form.tsx`, `app.initializer.tsx`, `dialog.item.tsx`, `env.example.tsx`, `app.header.tsx`).

## Code Organization (`src/lib` vs `src/components`)
- `apps/web/src/lib/components/ui/` — coss / design-system primitives only.
- `apps/web/src/lib/components/` — reusable shared components used by more than one feature (e.g. `peer.avatar.tsx`, `message.summary.tsx`, `app.header.tsx`). Same `[use-case].[type].tsx` naming. These may be domain-aware; they must not own page layout, routing, or list-loading.
- `apps/web/src/lib/` otherwise — generic utils, hooks, contexts.
- `apps/web/src/components/` — feature modules and composers that wire stores and layout (`dialog.container.tsx`, `dialog.item.tsx`, `auth.form.tsx`, `app.initializer.tsx`).
- `apps/web/src/components/pages/` — route page components only. See Next.js Page Extraction.

## Imports, Re-exports, and Canonical Sources
- **Do not re-export:** Do not create intermediate re-exports, pass-through exports, alias constants, or wrapper functions across files or packages.
- Always import canonical types, constants, utilities, and configurations directly from their owning package or source module (e.g. import shared constants/schemas directly from `@telegenie/config`, not via `@/env`, `@/constants`, or `@telegenie/agent`).

## UI vs SDK state

UI (`apps/web`) may **observe** MobX stores; it must **not** call slice or entity mutators. All writes to `globalStore` (nav, dialogs, auth, …) and entity stores go through `useSDK()` controller methods (`sdk.message.*`, `sdk.dialogFilter.*`, `sdk.auth.*`, …).

- **Writes:** `useSDK()` → controllers only. UI-facing types are `TeleGenieSDKView` / `StoreMapView` (no `update` / `hydrate` / `deleteByIds`, no slice `set*` / `getOrCreate*`).
- **Reads:** `useStore` / `useStoreEntities` / `useGlobalStoreDialog` / `useGlobalStoreThread` / `observer` (including `globalStore.nav.*` and `globalStore.dialogs`).
- Do **not** deep-import `@telegenie/sdk/*`. Import `@telegenie/sdk` only.
- `getOrCreateDialogUI` / `getOrCreateThreadUI` are writes (they allocate). UI uses `getDialogUI` / `getThreadUI` (or the hooks above).
- SDK internals (`UpdatesController`, persist hydrate, LocalDb bridge) still write stores directly.
- Every `packages/sdk/src/store/global/**/*.slice.ts` class **extends** `GlobalStoreSlice`. Call `this.observe()` at the end of the constructor (never `makeAutoObservable` — MobX forbids it on subclasses). Nested dialog/thread slices may also `implement` `DialogUIState` / `ThreadUIState` and persist via `toSnapshot` / `fromSnapshot`.

## Next.js Page Extraction
- Next.js files inside `apps/web/app/` are light route entrypoints. They import a page component and render it.
- Every page component used by an `apps/web/app/` route lives in `apps/web/src/components/pages/` and is named `*.page.tsx` (e.g. `auth.page.tsx`, `main.page.tsx`, `settings.page.tsx`).
- `apps/web/src/components/pages/` contains only those `*.page.tsx` files. Dialogs, forms, and other feature components stay in their feature folder (e.g. `components/auth/auth.form.tsx`, `components/settings/recent-reactions.dialog.tsx`).

## Multi-thread & communication (invariants)

TeleGenie uses five browser contexts. Do not collapse them or invent another without updating this section and `README.md`.

| Context | Package / entry | Ownership rule | Inter-thread Communication | Storage Owned |
|---|---|---|---|---|
| Main tab (SDK + UI) | `packages/sdk` | Per tab | worker-rpc to TG, Agent, and RLottie; hosts `LeaderTabApi` (if leader) & `TabPageApi`; `BroadcastChannel` | `localStorage`, `telegenie-sdk-cache_${accountSlot}` (IDB) |
| Telegram `SharedWorker` (`telegenie-telegram`) | `packages/libs/.../telegram/worker` | **One** shared Telegram + LocalDb for origin | worker-rpc host for tabs & SW; update fan-out | `telegenie-telegram_${accountSlot}` (IDB) |
| Agent DedicatedWorker (`telegenie-agent`) | `packages/agent` | **Per tab** — Genie/chat/crypto stay here | worker-rpc host (`AgentWorkerApi`) & client (`TabPageApi`) | `telegenie-memory_${accountSlot}` (IDB), `telegenie-agent_${tabId}` (IDB) |
| RLottie DedicatedWorkers (`telegenie-rlottie:N`) | `apps/web/src/lib/rlottie` | **Per tab**, pool of at most 4. Custom-emoji `.tgs` decode only | worker-rpc host (`RLottieWorkerApi`: `init`, `render`, `destroy`). Main tab is the client | none. Fetches `.tgs` from the page (`/media/` uses the SW cache). WASM glue stays in `apps/web/public/rlottie` |
| Service Worker (`/sw.js`) | `packages/sw` | Origin PWA shell | worker-rpc client to TG SW (`file.getPart`) & Leader Tab; BroadcastChannel observer | `CacheStorage` (`v1-assets`, `v1-media`, `pwa-shell`) |

### Protocols — pick the right one

- **worker-rpc** (`packages/libs/.../worker-rpc`): primary typed API (`call` / `result` / `stream` / `event`). Prefer extending existing `*WorkerApi` / `LeaderTabApi` / `TabPageApi` / `RLottieWorkerApi` surfaces over new ad-hoc messages. Host results that must move (RLottie `ImageBitmap` frames) return `rpcTransfer(value, transfer)`.
- **MessageChannel bridge** (`packages/libs/.../telegram/worker/sw-bridge-protocol.ts`): only for SW linking. Kinds `bridge.init` \| `bridge.ready` \| `bridge.close`. Links: `sw-telegram`, `sw-leader`. Handshake first, then worker-rpc on the same port. Leader tab hosts `LeaderTabApi` via `LeaderTab` in the SDK.
- **Agent ↔ tab page bridge** (`packages/agent/.../page-bridge-protocol.ts`): per-tab reverse channel. Kind `agent-page.init` + transferred `MessagePort` (not SW `bridge.*` links). Tab hosts `TabPageApi` via `exposeWorkerApi` (`TabPage` / `AgentModule.connectPageBridge`); agent holds `createWorkerClient<TabPageApi>`. DedicatedWorker `self` remains host for `AgentWorkerApi` (tab → agent). Two ports = bidirectional request/response.
- **BroadcastChannel** (`telegenie` + `TAB_MSG.*`): tab coordination and leader election only. SW may **observe**; it must not elect or claim leadership.
- **Page ↔ SW `postMessage`**: `bridge.init` + transferred MessagePorts (leader brokers). Progressive/download byte parts use Telegram SharedWorker `file.getPart` over the `sw-telegram` worker-rpc bridge. Share Target still posts one-way `share` payload to the new client after a share POST.

### Leader tab — hard rules

- Only the elected leader may call `SwModule.connectLeaderBridges` / `watchControllerChange` (exposes `LeaderTabApi` over worker-rpc).
- Followers talk to Telegram via the SharedWorker directly; they must **not** transfer competing bridge ports into the SW.
- Election lives in `TabLeaderElection` + `LeaderSlice` (`leaderTabId`, heartbeat TTL 8s, heartbeat interval 3s, lex-smaller `tabId` wins ties). Keep SW observer TTL in sync with `LEADER_HEARTBEAT_TTL_MS`.
- Normal SharedWorker connect paths must not send `BRIDGE_KIND_INIT`; only the leader broker does.

### Where to put changes

- Telegram MTProto / LocalDb / entity fan-out → Telegram SharedWorker handlers (`telegram.api` / `telegram.handlers`).
- Agent / Genie / crypto → Agent DedicatedWorker (not SW `server` handlers).
- Agent → UI / agent → Telegram-via-tab → `TabPageApi` on the hosting tab (not SW).
- Asset/cache/progressive/share/fetch strategies → Service Worker (`FetchManager`).
- Progressive/download media bytes → Telegram SharedWorker `file.getPart` (SW is RPC client only).
- Cross-tab UI coordination / leader state → BroadcastChannel + `LeaderSlice`.
- Message selection mode → `ThreadSlice` via SDK `MessageSelectController` (`sdk.messageSelect`). Not `DialogSlice`.
- Message list window / cache index (`listedIds`, `ThreadUIState.msgIndexes`) → SDK `MessageController` (`DialogSlice` / `ThreadSlice` mutators are SDK-internal; UI does not call them). Not LocalDb `msgIdRanges`.
- Orchestration (init order, when to bridge) → `TeleGenieSDK` / SDK modules (`SwModule`, `AgentModule`).
- Custom emoji playback → RLottie DedicatedWorkers (`apps/web/src/lib/rlottie/rlottie.worker.ts`). The main-tab pool (`rlottie-pool.ts`) is the worker-rpc client. Keep this out of the Agent worker and the Service Worker.

### Message list cache index

- `listedIds` is the listed scroller window (slides trim to 150). Live follow on the newest window may exceed 150 until the user slides; trimmed ids stay in `msgIndexes` and the per-peer message entity store.
- `ThreadUIState.msgIndexes` is the cache index for that thread: `cachedIds` (renderable entities), `deletedIds`, private `breaksAfter`, channel `resolvedRanges`. Persisted on the existing `telegenie-sdk-cache_*` `global` snapshot (no extra object store).
- **Private / basic group:** `breaksAfter` is an island split — the left cached id is not connected to the next. Example: `cachedIds = [10, 12, 14, 79, 80, 82]`, `breaksAfter = [14]`. Fill with `getHistory` from the edge, never by enumerating `15..78`. A delete does **not** add a break.
- **Channel:** `resolvedRanges` mark known ID spans. A numeric hole inside a span is deleted; a hole outside is unknown → `getMessages`. LocalDb `msgIdRanges` remains update-stream coverage only (`noteMessageId` / `pending`).
- Reply-target orphans may exist in the entity store without entering `cachedIds`.
- List loading: `MessageController.selectDialog` / `slideListedWindow` / `jumpToBottom` (cache-first).

### Message selection

- Selection is per **thread**, not per dialog: `ThreadSlice.isSelectMode` plus a private observable id set (`selectedMessageIds`, `isMessageSelected`). It is session-only and is never in `ThreadUISnapshot`. `DialogSlice` has no selection field.
- UI writes only through `sdk.messageSelect` (`enter`, `toggle`, `exit`, `getSelectedMessages`, `copyText`), always with the active thread id. Shift-click ranges come from that thread's `listedIds`.
- Selection ends when: the last id is deselected, `NavSlice.setSelectedDialogId` leaves the dialog, `DialogSlice.setActiveThreadId` changes thread, or a delete prunes it (`UpdatesController.applyMessageDelete`, every thread of the peer).
- Toolbar actions come from `selectionMenuActions` (`every` over per-message actions). Only normal messages with a positive id are selectable. Forward stays single-message.
- `MessageListRow` renders each message or album through an observer row (`SelectableMessageRow`), so a toggle re-renders only the affected rows. The select-mode click is a capture handler on the row. `MessageContextMenu` gets `selectMode` and stays mounted but does not open.

### Custom emoji documents

- Store name `customEmoji` (`CustomEmojiDocument`). A message entity only has the document id. The document (thumb, mime, file location) is not a LocalDb peer and is not a `fileRefs` row.
- Lookup: MobX memory → `telegenie-sdk-cache_*` object store `customEmoji` (leader writes, same as dialogs/messages) → `messages.getCustomEmojiDocuments` (at most 100 ids, 200ms apart). Empty `mimeType` is a placeholder.
- UI reads `useStoreEntities('customEmoji', documentId)`. Documents already loaded by the picker, composer, or emoji suggest are written with `sdk.sticker.rememberCustomEmoji`. Do not add a per-tab document map in `apps/web`.
- Playback is separate from this document cache. Each tab runs a pool of at most 4 RLottie DedicatedWorkers (`telegenie-rlottie:N`) and calls `RLottieWorkerApi` over worker-rpc. `render` transfers an `ImageBitmap`. The picker keeps one `CustomEmojiSurface` canvas for the featured strip, one for the open set, and one for the search grid. Each message bubble has its own surface, so that canvas scrolls and clips with the bubble. Media bytes still go through `/media/` and the service-worker media cache. The Emscripten glue (`rlottie-wasm.js`, `rlottie-wasm.wasm`) stays in `apps/web/public/rlottie`; the worker source is `rlottie.worker.ts`.

### Key files

- SDK orchestration: `packages/sdk/src/telegenie.sdk.ts`
- SW module (register + leader bridges): `packages/sdk/src/modules/sw/sw.module.ts`
- Leader tab SW RPC host: `packages/sdk/src/modules/sw/leader-tab.ts`
- LeaderTabApi types: `packages/libs/src/types/leader-tab.api.ts`
- Tab page agent RPC host: `packages/sdk/src/modules/agent/tab-page.ts`
- Agent module (worker client + `connectPageBridge`): `packages/sdk/src/modules/agent/agent.module.ts`
- TabPageApi types: `packages/libs/src/types/tab-page.api.ts`
- Agent page bridge protocol: `packages/agent/src/worker/page-bridge-protocol.ts`
- Bridge protocol (SW only): `packages/libs/src/foundation/telegram/worker/sw-bridge-protocol.ts`
- Leader election: `packages/sdk/src/modules/tab-leader/tab-leader-election.ts`
- worker-rpc: `packages/libs/src/foundation/worker-rpc/`
- Tab broadcast: `packages/libs/src/foundation/broadcast-channel/`
- SW: `packages/sw/src/telegenie.service-worker.ts`, `packages/sw/src/fetch-manager.ts`
- Agent package entry: `packages/agent/src/index.ts`
- Agent worker entry & init: `packages/agent/src/worker/agent.worker.ts`, `packages/agent/src/worker/agent-worker-init.ts`
- Memory DB: `packages/agent/src/memory/db/`
- Memory Engine: `packages/agent/src/memory/engine/`
- LangGraph graph & state: `packages/agent/src/agent/graph.ts`, `packages/agent/src/agent/state.ts`
- Message cache index: `packages/sdk/src/store/utils/message-cache-index.ts`, `packages/sdk/src/modules/message/message.controller.ts`, `packages/sdk/src/store/global/global.store.ts`, `packages/sdk/src/store/global/global-store.slice.ts`, `packages/sdk/src/store/global/models/thread.slice.ts`
- RLottie pool / API / worker: `apps/web/src/lib/rlottie/rlottie-pool.ts`, `apps/web/src/lib/rlottie/rlottie.api.ts`, `apps/web/src/lib/rlottie/rlottie.worker.ts`

## Agent Architecture & Multi-tab Invariants

- **Leader-Only Extraction**: Memory extraction (`MemoryEngine.processMessages`) is CPU/LLM intensive and MUST run **only on the elected leader tab**. `AgentController.processNewMessages` checks `isLeader()` before dispatching to its DedicatedWorker.
- **Dual IndexedDB Namespace**:
  - `telegenie-memory_${accountSlot}` — shared memory store across all tabs for an account. Stores `entities`, `memories`, `memory_sources`, `commitments`, `embeddings`.
  - `telegenie-agent_${tabId}` — per-tab agent state store (`agent_runs`, `agent_messages`, `tool_calls`, `agent_checkpoints`, `dialog_presets`). Tab ID namespacing prevents run history conflicts across tabs.
- **Idempotency & Traceability**:
  - Every `Memory` record MUST have ≥1 `MemorySource` referencing `messageId` (`${peerId}:${messageId}`).
  - `MemoryConsolidator` checks `memory_sources.messageId` before extraction to prevent duplicate processing if tab leadership changes mid-sync.
- **Stale Agent Run Cleanup**:
  - On agent worker startup (`cleanupAgentDb`), `agent_runs` older than 7 days are hard-deleted along with orphaned `agent_messages`, `tool_calls`, and `agent_checkpoints`.
  - Permanent user settings (`dialog_presets`) and `telegenie-memory` records are **never hard-pruned** automatically during cleanup.
- **API Responsibility Boundary**:
  - `AgentWorkerApi`: Data transfer (Telegram message records, chat prompts, model config).
  - `TabPageApi`: UI updates only (token streaming via `streamToken`, UI status flags).

