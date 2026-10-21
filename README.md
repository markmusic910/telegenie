# TeleGenie

A modern Next.js application with a comprehensive Telegram SDK, built with TypeScript, React 19, and deployed to Cloudflare.

## 🏗️ Project Structure

This is a **Yarn workspace monorepo** (always use `yarn`, do not use `pnpm` or `npm`) with the following structure:

```
TeleGenie/
├── apps/
│   └── web/              # Next.js 16 application
├── packages/
│   ├── sdk/              # TeleGenie SDK (orchestration, MobX stores, modules)
│   ├── libs/             # Shared foundation (worker-rpc, Telegram worker)
│   ├── sw/               # Service Worker package
│   ├── agent/            # Per-tab Agent DedicatedWorker
│   └── teleproto/        # Telegram protocol helpers
└── package.json
```

### UI component organization (best practice)

Keep feature composers out of the shared library, and keep coss primitives out of feature folders.

| Location | Put here | Examples |
|---|---|---|
| `apps/web/src/lib/components/ui/` | Coss / design-system primitives only | `button.tsx`, `avatar.tsx`, `badge.tsx` |
| `apps/web/src/lib/components/` | Reusable shared components used by more than one feature. Same `[use-case].[type].tsx` naming. May be domain-aware; must not own page layout, routing, or list-loading. | `peer.avatar.tsx`, `message.summary.tsx`, `app.header.tsx` |
| `apps/web/src/lib/` | Generic utils, hooks, contexts | `sdk.context.tsx`, `utils/date.ts` |
| `apps/web/src/components/` | Feature modules and composers that wire stores and layout | `dialog.container.tsx`, `dialog.item.tsx`, `auth.form.tsx` |
| `apps/web/src/components/pages/` | Route page components only (`*.page.tsx`), one for each `apps/web/app/` page entry. Dialogs and forms stay in their feature folder. | `auth.page.tsx`, `main.page.tsx`, `settings.page.tsx` |

Agent-facing source of truth: `AGENTS.md`.

Agents must **not** auto-open or drive a browser to verify UI. The human verifies in their own session.

## 🧵 Multi-thread Architecture & Storage Layout

TeleGenie splits work across several browser execution contexts so Telegram sessions, AI/agent state, and PWA concerns stay isolated, responsive, and shareable across tabs.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Main Tab (Window - SDK + MobX UI)                                                      │
│ ├─ Storage: localStorage, IndexedDB (`telegenie-sdk-cache_${accountSlot}`)             │
│ ├─ Role: SDK orchestration, MobX stores, Tab Leader Election                           │
│ ├─ Communication:                                                                      │
│ │  ├─ worker-rpc ──► Telegram SharedWorker                                             │
│ │  ├─ worker-rpc ──► Agent DedicatedWorker (AgentWorkerApi)                            │
│ │  ├─ worker-rpc ◄── Agent DedicatedWorker (Hosts TabPageApi via agent-page bridge)   │
│ │  ├─ worker-rpc ◄── Service Worker (Hosts LeaderTabApi via sw-leader bridge)          │
│ │  ├─ worker-rpc ──► RLottie DedicatedWorkers (RLottieWorkerApi, at most 4)           │
│ │  └─ BroadcastChannel ("telegenie") for leader election & cross-tab events           │
└──────────────────────────┬─────────────────────────────────┬───────────────────────────┘
                           │ worker-rpc                      │ agent-page MessageChannel
                           ▼                                 ▼
┌──────────────────────────────────────────┐    ┌────────────────────────────────────────┐
│ Telegram SharedWorker                    │    │ Agent DedicatedWorker                  │
│ (`telegenie-telegram`)                   │    │ (`telegenie-agent`)                    │
│ ├─ Scope: One process for the origin     │    │ ├─ Scope: Per tab                      │
│ ├─ Storage: IndexedDB                    │    │ ├─ Storage:                            │
│ │  (`telegenie-telegram_${accountSlot}`) │    │ │  ├─ `telegenie-memory_${accountSlot}`  │
│ ├─ Role: MTProto client, entity fanout   │    │ │  ├─ `telegenie-agent_${tabId}`       │
│ └─ Communication:                        │    │ │  └─ Reads `telegenie-sdk-cache`      │
│    ├─ worker-rpc host for all tabs       │    │ ├─ Role: LangGraph graph, Memory Engine│
│    └─ worker-rpc to SW (sw-telegram)     │    │ └─ Communication:                      │
└────────────────────┬─────────────────────┘    │    ├─ worker-rpc host (AgentWorkerApi) │
                     │ MessageChannel           │    └─ worker-rpc client (TabPageApi)   │
                     ▼                          └────────────────────────────────────────┘
┌──────────────────────────────────────────┐    ┌────────────────────────────────────────┐
│ Service Worker (/sw.js)                  │    │ RLottie DedicatedWorkers               │
│ ├─ Scope: Origin PWA shell               │    │ (`telegenie-rlottie:N`)                │
│ ├─ Storage: CacheStorage                 │    │ ├─ Scope: Per tab, pool of at most 4   │
│ │  (`v1-assets`, `v1-media`, `pwa-shell`)│    │ ├─ Storage: none                       │
│ ├─ Role: Offline cache, media stream     │    │ ├─ Role: .tgs decode, ImageBitmap frame│
│ └─ Communication:                        │    │ └─ worker-rpc host (RLottieWorkerApi)  │
│    ├─ worker-rpc client to TG SW         │    └────────────────────────────────────────┘
│    ├─ worker-rpc client to Leader Tab    │
│    └─ BroadcastChannel observer          │
└──────────────────────────────────────────┘
```

### Execution Contexts & Communication Summary

| Context | Kind | Scope | Inter-Thread Communication | Persistence / Storage |
|---|---|---|---|---|
| **Main Tab** | Window | Per Tab | • `worker-rpc` to Telegram SharedWorker<br>• `worker-rpc` bidirectional with Agent DedicatedWorker<br>• `worker-rpc` client to the RLottie pool (`RLottieWorkerApi`)<br>• Hosts `LeaderTabApi` over `sw-leader` MessageChannel (if leader)<br>• `BroadcastChannel` (`telegenie`) leader election | • `localStorage` (`tabId`, auth refs, UI prefs)<br>• `telegenie-sdk-cache_${accountSlot}` (IndexedDB - cached MobX stores written by leader tab) |
| **Telegram Worker** | `SharedWorker` | One per Origin | • `worker-rpc` host for all tabs<br>• `worker-rpc` host to Service Worker over `sw-telegram` MessageChannel<br>• Multi-port update fan-out to active tabs | • `telegenie-telegram_${accountSlot}` (IndexedDB / LocalDb - MTProto entities, peers, sessions, full message history) |
| **Agent Worker** | `Worker` | Per Tab | • Hosts `AgentWorkerApi` over `Worker.self`<br>• Calls `TabPageApi` over `agent-page.init` MessageChannel<br>• Gated Memory Engine calls triggered by leader tab | • `telegenie-memory_${accountSlot}` (IndexedDB - shared semantic memory & commitments)<br>• `telegenie-agent_${tabId}` (IndexedDB - per-tab agent state & checkpoints)<br>• Reads `telegenie-sdk-cache_${accountSlot}` directly |
| **RLottie Workers** | `Worker` | Per Tab (pool of at most 4) | • Hosts `RLottieWorkerApi` (`init`, `render`, `destroy`) over `Worker.self`<br>• `render` transfers an `ImageBitmap` via `rpcTransfer` | • None. Fetches `.tgs` from the page (`/media/` still uses the SW media cache). WASM glue is `apps/web/public/rlottie/rlottie-wasm.js` and `rlottie-wasm.wasm` |
| **Service Worker** | ServiceWorker | Origin | • `worker-rpc` client to Telegram SharedWorker (`file.getPart`) over `sw-telegram`<br>• `worker-rpc` client to Leader Tab over `sw-leader`<br>• `BroadcastChannel` **observer only** | • `CacheStorage` (`v1-assets`, `v1-media`, `pwa-shell`) |

### Protocols — Pick the Right One

1. **worker-rpc** (`packages/libs/.../worker-rpc`) — Typed `call` / `result` / `stream` / `event` RPC over `MessagePort`. Primary protocol for tab ↔ SharedWorker, tab ↔ Agent worker, agent ↔ tab page, tab ↔ RLottie workers, and SW ↔ bridged peers. Transferable results (RLottie frames) use `rpcTransfer`.
2. **MessageChannel bridge** (`packages/libs/.../telegram/worker/sw-bridge-protocol.ts`) — Handshake (`bridge.init` / `ready` / `close`) then worker-rpc on the same port. Two links:
   - `sw-telegram` — SW ↔ Telegram SharedWorker
   - `sw-leader` — SW ↔ leader tab (`LeaderTabApi` in SDK: ping, sound, focusMessage)
3. **Agent ↔ Tab Page bridge** (`packages/agent/.../page-bridge-protocol.ts`) — Bidirectional tab ↔ agent over **two** ports:
   - Port 1 (Worker `self`): tab client → `AgentWorkerApi` host (Telegram message payloads, chat prompts, model config)
   - Port 2 (`agent-page.init` MessageChannel): agent client → `TabPageApi` host on page (`TabPage` / `AgentModule.connectPageBridge` for streaming LLM tokens via `streamToken` and UI status updates)
4. **BroadcastChannel** (`telegenie`) — Cross-tab coordination and leader election (`TAB_MSG.*`). SW **observes only**; it does not elect or claim leadership.
5. **Page ↔ SW `postMessage`** — `bridge.init` + port transfer. Progressive/download byte parts use Telegram SharedWorker `file.getPart` over the `sw-telegram` worker-rpc bridge. Share Target posts one-way `share` payload to the opened client.

### Storage & Persistence Matrix

| Storage Store Name | Type | Scope | Owner / Writer Context | Description |
|---|---|---|---|---|
| `telegenie-telegram_${accountSlot}` | IndexedDB | Account Slot | Telegram SharedWorker | Complete Telegram state: entities, dialogs, full message history, MTProto auth session keys. |
| `telegenie-sdk-cache_${accountSlot}` | IndexedDB | Account Slot | Leader Main Tab (`StoreCache`) | MobX store snapshot (`dialog`, `dialogFilter`, `message`, `customEmoji`, `global`). `global` includes per-thread `listedIds` and `msgIndexes`. `customEmoji` is the custom-emoji document cache (memory → this store → `messages.getCustomEmojiDocuments`). Read by Agent DedicatedWorker. |
| `telegenie-memory_${accountSlot}` | IndexedDB | Account Slot | Agent DedicatedWorker (Leader Tab only) | Shared semantic memory engine store: `entities`, `memories`, `memory_sources`, `commitments`, `embeddings`. |
| `telegenie-agent_${tabId}` | IndexedDB | Per Tab | Agent DedicatedWorker | Tab-namespaced agent state: `agent_runs`, `agent_messages`, `tool_calls`, `agent_checkpoints`, and `dialog_presets` (permanent user-configured per-chat context & tone, preserved across cleanups). |
| `CacheStorage` | CacheStorage | Origin | Service Worker | SW caching layers: `v1-assets` (PWA shell & static assets) and `v1-media` (progressive byte chunks). |
| `localStorage` | LocalStorage | Per Origin / Tab | Main Tab | Lightweight UI preferences, tab session IDs (`tabId`), and auth state flags. |

### Leader Tab Hard Rules

- Only the elected leader tab calls `SwModule.connectLeaderBridges` / `watchControllerChange` (hosts `LeaderTabApi`).
- Only the elected leader tab calls `AgentController.processNewMessages` to trigger Memory Engine extractions.
- Followers talk to Telegram via the SharedWorker directly; they do **not** transfer competing bridge ports into the SW.
- Election lives in `TabLeaderElection` + `LeaderSlice` (`leaderTabId`, heartbeat TTL 8s, heartbeat interval 3s, lex-smaller `tabId` wins ties).

Key entrypoints: `packages/sdk/src/telegenie.sdk.ts`, `packages/sdk/src/modules/sw/sw.module.ts`, `packages/sdk/src/modules/sw/leader-tab.ts`, `packages/sdk/src/modules/agent/tab-page.ts`, `packages/sdk/src/modules/agent/agent.module.ts`, `packages/libs/src/types/tab-page.api.ts`, `packages/agent/src/worker/page-bridge-protocol.ts`, `packages/sw/src/telegenie.service-worker.ts`, `packages/libs/src/foundation/telegram/worker/`, `apps/web/src/lib/rlottie/rlottie.worker.ts`.

### Message list cache

The message list does not treat every missing integer id as a message of this chat.

- `listedIds` is a sliding listed-scroller window (max 150). `ThreadUIState.msgIndexes` is the cache index (cached / deleted / private island breaks / channel resolved spans), persisted on the SDK `global` snapshot. Per-thread state lives on `ThreadSlice` (extends `GlobalStoreSlice`). Message selection mode (`isSelectMode`, selected ids) is also per-thread and session-only; the UI writes it through `sdk.messageSelect`.
- **Private chats:** a gap is `breaksAfter` (e.g. `[10,12,14 | 79,80,82]`). Fill with `getHistory`, not id enumeration.
- **Channels:** numeric holes inside `resolvedRanges` are deleted; holes outside are fetched with `getMessages`.

See [`packages/sdk/README.md`](packages/sdk/README.md) for the worked example.

### Custom emoji playback

Custom emoji documents live in the SDK `customEmoji` store. Playback is a separate per-tab pool of at most four RLottie DedicatedWorkers (`telegenie-rlottie:0` and up). The main tab is the worker-rpc client (`RLottieWorkerApi`: `init`, `render`, `destroy` in `apps/web/src/lib/rlottie/rlottie-pool.ts`). `render` transfers an `ImageBitmap`. Workers fetch the `.tgs` URL and load the classic Emscripten glue from `/rlottie/rlottie-wasm.js` (`apps/web/public/rlottie/`). The worker source is `apps/web/src/lib/rlottie/rlottie.worker.ts`.

## 🤖 Agent System Architecture

TeleGenie incorporates a local-first, memory-grounded AI agent powered by **LangGraph** running in a per-tab DedicatedWorker (`packages/agent`).

### Architecture Overview

```
Telegram MTProto Sync
    │
    ▼
Existing Telegram IndexedDB & StoreCache
    │
    ▼ [Leader Tab Only - Gated by TabLeaderElection]
Memory Engine (CandidateDetector → MemoryExtractor → EntityResolver → MemoryConsolidator)
    │
    ▼
IndexedDB Memory Store (`telegenie-memory_${accountSlot}`)
    │
    ▼
User Asks Agent ("What did John promise?")
    │
    ▼
LangGraph Execution Graph (UNDERSTAND → RETRIEVE → GENERATE)
    │
    ▼
Grounded Answer (Streamed to UI via TabPageApi)
```

### Core Subsystems

1. **Memory Engine (`packages/agent/src/memory/engine/`)**
   - **Candidate Detector**: Heuristic regex pre-filter to skip non-memory messages.
   - **Memory Extractor**: Structured LLM extraction using ChatOpenAI and Zod schemas (`FACT`, `PREFERENCE`, `RELATIONSHIP`, `COMMITMENT`, `EVENT`, `PROJECT`, `TOPIC`).
   - **Entity Resolver**: Dedups named entities (people, places, orgs) and links them to Telegram user IDs.
   - **Memory Consolidator**: Ensures idempotency via `memory_sources.messageId`, updates superseded facts, and writes structured `Commitment` records.

2. **Dual Storage Strategy**
   - **Shared Memory DB (`telegenie-memory_${accountSlot}`)**: Persists `entities`, `memories`, `memory_sources`, `commitments`, and `embeddings`. Shared across all tabs of an account slot.
   - **Per-Tab Agent State DB (`telegenie-agent_${tabId}`)**: Namespaced per-tab to avoid run history collisions. Auto-cleans `agent_runs` older than 7 days on startup.

3. **LangGraph Agent Runtime (`packages/agent/src/agent/`)**
   - **StateGraph**: Multi-phase pipeline:
     1. `understandNode`: Classifies question intent.
     2. `retrieveNode`: Searches `telegenie-memory` and `telegenie-sdk-cache`.
     3. `generateNode`: Synthesizes context using `ContextBuilder` and produces grounded LLM responses.
   - **Checkpointer**: Uses LangGraph `MemorySaver`.

4. **Multi-Tab Concurrency & Boundaries**
   - Memory extraction is CPU/LLM intensive and runs **only on the elected leader tab**.
   - `AgentWorkerApi` carries Telegram data and triggers execution; `TabPageApi` carries UI callbacks (token streaming).


## 🚀 Tech Stack

### Frontend (apps/web)
- **Framework**: Next.js 16.2 with App Router
- **React**: 19.1 with TypeScript
- **Styling**: Tailwind CSS v4
- **State Management**: MobX
- **Animations**: Motion (Framer Motion)
- **Build Tool**: Turbopack
- **Deployment**: Cloudflare Pages via @opennextjs/cloudflare

### SDK (packages/sdk)
- **Telegram Client**: telegram npm package
- **State Management**: MobX
- **Type Safety**: Full TypeScript coverage
- **Architecture**: Modular service-based design

## 📦 Installation

### Prerequisites
- Node.js >= 26.7.0
- Yarn >= 4.18.0

### Setup

1. **Install dependencies**:
   ```bash
   yarn install
   ```

2. **Configure environment variables**:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```
   
   Edit `apps/web/.env.local` with your Telegram API credentials and other configuration.

## 🛠️ Development

### Start development server
```bash
yarn dev
```

The app will be available at http://localhost:4000

### Build for production
```bash
yarn build
```

### Preview production build
```bash
yarn preview
```

### Lint code
```bash
yarn lint
```

## 📱 Available Workspaces

- `@telegenie/web` — Next.js application
- `@telegenie/sdk` — SDK orchestration, stores, modules
- `@telegenie/libs` — shared foundation (worker-rpc, bridges, Telegram worker)
- `@telegenie/decorators` — shared TypeScript decorators (`@Log`, etc.)
- `@telegenie/sw` — Service Worker
- `@telegenie/agent` — per-tab Agent DedicatedWorker

### Workspace commands

Run commands in specific workspaces:

```bash
# Development server for web app
yarn workspace @telegenie/web dev

# Build SDK package
yarn workspace @telegenie/sdk build

# Type checking for web app
yarn workspace @telegenie/web typecheck
```

## 🌐 Deployment

### Cloudflare Pages

This project is configured for deployment to Cloudflare Pages using OpenNext.

1. **Build the project**:
   ```bash
   yarn build
   ```

2. **Deploy with Wrangler**:
   ```bash
   wrangler pages deploy .vercel/output/static
   ```

3. **Configure environment variables** in your Cloudflare dashboard.

## 🔧 Configuration

### Environment Variables

The project uses type-safe environment variables. See `apps/web/.env.example` for all available options.

Key variables:
- `NEXT_PUBLIC_TELEGRAM_API_ID` - Your Telegram API ID
- `NEXT_PUBLIC_TELEGRAM_API_HASH` - Your Telegram API Hash
- `NEXT_PUBLIC_APP_NAME` - Application name
- `NEXT_PUBLIC_ENABLE_DEBUG` - Enable debug mode

### Telegram SDK

The SDK is located in `packages/sdk`. It provides:
- Telegram API client integration
- Message, chat, and user services
- MobX-based state management
- Type-safe API types

See `packages/sdk/README.md` for detailed SDK documentation.

## 📝 Development Workflow

1. **Create a new feature branch**
2. **Make your changes** in the appropriate workspace
3. **Test locally** with `yarn dev`
4. **Build** with `yarn build` to ensure no errors
5. **Commit and push** your changes

## 🏗️ Project Features

- ✅ React 19 with TypeScript
- ✅ Next.js 16 with App Router
- ✅ Tailwind CSS v4 for styling
- ✅ MobX for state management
- ✅ Yarn workspace monorepo
- ✅ PWA capabilities
- ✅ Cloudflare deployment ready
- ✅ ESLint + Prettier for code quality
- ✅ Husky for git hooks
- ✅ Type-safe environment variables

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [MobX Documentation](https://mobx.js.org)
- [Cloudflare Pages](https://pages.cloudflare.com)
- [Telegram API](https://core.telegram.org/)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private and proprietary.
