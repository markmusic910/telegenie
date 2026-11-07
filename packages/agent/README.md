# @telegenie/agent

Per-tab AI Agent DedicatedWorker for TeleGenie. Responsible for LangGraph execution, real-time token streaming, contextual retrieval, semantic memory extraction, and per-user execution persistence.

---

## Table of Contents

- [Overview & Architecture](#overview--architecture)
- [Multi-Thread & Storage Invariants](#multi-thread--storage-invariants)
- [Architectural Diagram](#architectural-diagram)
- [Core Workflows](#core-workflows)
  - [1. Interactive Chat & Token Streaming](#1-interactive-chat--token-streaming)
  - [2. Semantic Memory Extraction (Leader Tab Only)](#2-semantic-memory-extraction-leader-tab-only)
  - [3. Context Retrieval & Prompt Assembly](#3-context-retrieval--prompt-assembly)
  - [4. Worker Initialization & Stale Run Cleanup](#4-worker-initialization--stale-run-cleanup)
- [Key Components Directory](#key-components-directory)
  - [Worker & RPC Communication](#worker--rpc-communication)
  - [LangGraph Agent Pipeline](#langgraph-agent-pipeline)
  - [Memory Engine](#memory-engine)
  - [Runtime & Retrieval](#runtime--retrieval)
  - [Storage & Repositories](#storage--repositories)

---

## Overview & Architecture

TeleGenie runs an isolated DedicatedWorker (`telegenie-agent:${accountSlot}:${tabId}`) for every active browser tab. This isolates LLM stream parsing, LangGraph state transitions, vector/keyword memory searches, and candidate extraction from the UI thread.

```
Main Tab (Window) <====== bidirectional worker-rpc ======> Agent DedicatedWorker
 (Hosts TabPageApi)                                      (Hosts AgentWorkerApi)
```

### Architectural Diagram

```mermaid
flowchart TB
    subgraph MainTab["Main Tab (Browser Window)"]
        UI["React UI (Genie Panel / Chat)"]
        SDK["TeleGenie SDK (AgentController)"]
        TabLeader["TabLeaderElection (Heartbeat TTL 8s)"]
        TabPage["TabPage (Hosts TabPageApi)"]
        SDKCache["IDB: telegenie-sdk-cache_accountSlot"]
        UI --> SDK
        SDK --> TabPage
        TabLeader -.->|"isLeader() gate"| SDK
    end

    subgraph AgentWorker["Agent DedicatedWorker (telegenie-agent:accountSlot:tabId)"]
        direction TB

        subgraph RPC["RPC & Bridge Layer"]
            WorkerSelf["self (Hosts AgentWorkerApi)"]
            TabPageClient["TabPageClient (Calls TabPageApi)"]
            Init["agent-worker-init.ts"]
        end

        subgraph Graph["LangGraph State Graph"]
            Understand["understandNode (Intent Classifier)"]
            Retrieve["retrieveNode (Memory & Message Fetch)"]
            Generate["generateNode (Streaming LLM Synthesis)"]
            Checkpointer["MemorySaver Checkpointer"]

            Understand --> Retrieve --> Generate
        end

        subgraph Runtime["Runtime & Retrieval"]
            Retriever["Retriever (Cross-DB Query Engine)"]
            ContextBuilder["ContextBuilder (Persona + Tone + Skills)"]
            PresetService["PresetService (Task & Dialog Presets)"]
        end

        subgraph MemoryEngineSub["Memory Engine (Leader Only)"]
            Detector["CandidateDetector (Regex pre-filter)"]
            Extractor["MemoryExtractor (LLM Structured Output)"]
            Resolver["EntityResolver (Entity Linking)"]
            Consolidator["MemoryConsolidator (Dedup & Supersede)"]

            Detector --> Extractor --> Resolver --> Consolidator
        end

        subgraph Storage["Storage Layer (IndexedDB Repositories)"]
            AgentDb["AgentDb (telegenie-agent_accountSlot)"]
            MemoryDb["MemoryDb (telegenie-memory_accountSlot)"]
        end
    end

    SDK -- "AgentWorkerApi.chat / processNewMessages" --> WorkerSelf
    TabPageClient -- "TabPageApi.streamToken (via agent-page MessagePort)" --> TabPage

    WorkerSelf --> Init
    Init --> Graph
    Init --> MemoryEngineSub
    Init --> Runtime

    Retrieve --> Retriever
    Generate --> ContextBuilder
    Generate --> TabPageClient

    Retriever --> SDKCache
    Retriever --> MemoryDb
    Retriever --> AgentDb

    Consolidator --> MemoryDb
    Checkpointer --> AgentDb
    WorkerSelf --> AgentDb
```

---

## Multi-Thread & Storage Invariants

The Agent Worker strictly adheres to the following system invariants:

1. **Leader-Only Extraction**:
   - Memory extraction (`MemoryEngine.processMessages`) is LLM and resource intensive.
   - It runs **strictly on the elected leader tab**. `AgentController.processNewMessages()` verifies `tabLeaderElection.isLeader()` before dispatching to the worker. Follower tabs skip extraction.
2. **Dual IndexedDB Namespaces**:
   - `telegenie-memory_${accountSlot}`: Account-wide shared memory database across all tabs. Contains `entities`, `memories`, `memory_sources`, `embeddings`, and `dialog_memory_sync`.
   - `telegenie-agent_${accountSlot}`: Shared agent state database per account slot. Contains `agent_runs`, `agent_messages`, `tool_calls`, `agent_checkpoints`, and `dialog_presets`. Preserves conversation history and dialog presets across tabs and browser restarts.
3. **Idempotency & Traceability**:
   - Every `Memory` entity is linked to at least one `MemorySource` record referencing `${peerId}:${messageId}`.
   - `MemoryConsolidator` checks `memorySourceRepo.existsForMessageId()` before extraction to prevent duplicate processing if tab leadership changes mid-sync.
4. **Stale Run Cleanup**:
   - On worker bootstrap, `cleanupAgentDb()` deletes `agent_runs` older than 30 days (`AGENT_RUN_TTL_DAYS`).
   - Orphaned `agent_messages`, `tool_calls`, and `agent_checkpoints` are cascaded and pruned. Permanent settings (`dialog_presets`) and semantic memories are **never** hard-pruned.
5. **API Responsibility Boundary**:
   - `AgentWorkerApi` (Tab &rarr; Agent): Transfers Telegram message records, chat prompts, model credentials, preset assignments.
   - `TabPageApi` (Agent &rarr; Tab): UI-only updates (token streaming via `streamToken`, execution status).

---

## Core Workflows

### 1. Interactive Chat & Token Streaming

When the user enters a prompt in the Genie UI or chat composer, the request passes to `AgentWorkerApi.chat()`. The agent creates a run, persists the user message in `AgentDb`, evaluates the LangGraph nodes, streams tokens back via `TabPageApi`, and persists the final assistant response.

```mermaid
sequenceDiagram
    autonumber
    actor User as User / UI
    participant Tab as Main Tab (SDK TabPage)
    participant Worker as Agent Worker (AgentWorkerApi)
    participant DB as AgentDb (telegenie-agent_accountSlot)
    participant Graph as LangGraph (understand -> retrieve -> generate)
    participant LLM as Chat Model (OpenAI / Anthropic / Gemini)

    User->>Tab: Send prompt
    Tab->>Worker: AgentWorkerApi.chat(userMessage, options)
    Worker->>DB: agentRunRepo.create() [status = RUNNING]
    Worker->>DB: agentMessageRepo.insert(USER, userMessage)

    Worker->>Graph: graph.invoke({ messages, runId, peerId })

    Note over Graph: understandNode classifies intent
    Note over Graph: retrieveNode fetches contextual memories & dialogue
    Note over Graph: generateNode builds prompt & opens LLM stream

    Graph->>LLM: model.stream(messagesWithContext)
    loop Stream chunks
        LLM-->>Graph: token chunk
        Graph->>Tab: TabPageApi.streamToken(runId, token)
        Tab-->>User: Render token in chat bubble
    end

    Graph-->>Worker: Final response & thinking trace
    Worker->>DB: agentMessageRepo.insert(ASSISTANT, text, thought)
    Worker->>DB: agentRunRepo.updateStatus(runId, COMPLETED)
    Worker-->>Tab: return { text, thought }

    opt Background Title Generation (First Run)
        Worker->>LLM: Generate 3-5 word concise title
        Worker->>DB: agentRunRepo.updateTitle(runId, title)
    end
```

---

### 2. Semantic Memory Extraction (Leader Tab Only)

The SDK monitors incoming Telegram messages. If the current tab is the elected leader, it streams messages to `AgentWorkerApi.processNewMessages()`. The `MemoryEngine` filters candidates, calls structured extraction, resolves entities, and persists traceable facts.

```mermaid
sequenceDiagram
    autonumber
    participant SDK as SDK UpdatesController (Leader Tab)
    participant Worker as Agent Worker
    participant Engine as MemoryEngine
    participant Detector as CandidateDetector
    participant Extractor as MemoryExtractor (LLM)
    participant Resolver as EntityResolver
    participant Consolidator as MemoryConsolidator
    participant MemDB as MemoryDb (telegenie-memory_accountSlot)

    SDK->>Worker: AgentWorkerApi.processNewMessages(messages)
    Worker->>Engine: processMessages(messages)

    loop Each message record
        Engine->>Detector: isMemoryCandidate(message)
        alt Not a candidate (fails regex pattern)
            Detector-->>Engine: false (skip)
        else Candidate matches
            Detector-->>Engine: true
            Engine->>Consolidator: Check if messageId already processed
            Consolidator->>MemDB: memorySourceRepo.existsForMessageId(messageId)
            alt Already processed
                MemDB-->>Consolidator: true (skip duplicate)
            else New message
                Engine->>Extractor: extract(message)
                Extractor-->>Engine: ExtractionCandidate[] (Zod validated)
                
                loop Each candidate
                    Engine->>Consolidator: consolidate(candidate, message)
                    Consolidator->>Resolver: resolve(candidate.subject, message)
                    Resolver->>MemDB: entityRepo.upsert(entity)
                    Resolver-->>Consolidator: Subject Entity ID

                    opt Check active predicate
                        Consolidator->>MemDB: memoryRepo.findActiveBySubjectAndPredicate()
                        Note over Consolidator,MemDB: Supersede previous memory if facts changed
                    end

                    Consolidator->>MemDB: memoryRepo.create(memory)
                    Consolidator->>MemDB: memorySourceRepo.insert(memoryId, messageId)
                end
            end
        end
    end

    Engine-->>Worker: ProcessMessagesResult
    Worker-->>SDK: void
```

---

### 3. Context Retrieval & Prompt Assembly

During execution of `retrieveNode` and `generateNode`, the worker gathers contextual background from multiple stores and dynamic prompt sources.

```mermaid
flowchart TD
    UserQuery["User Query + Message History"] --> UnderstandNode["understandNode: Intent Classification"]

    UnderstandNode --> Intent{Intent Type}
    Intent -->|FOLLOW_UP| FetchFollowUp["Search recent memories + peer dialogue history"]
    Intent -->|PREFERENCE| FetchPref["Search user preferences (type = PREFERENCE)"]
    Intent -->|FACT| FetchFact["Search factual assertions by query text"]
    Intent -->|GENERAL| FetchGeneral["Full-text search across memories + messages"]

    FetchFollowUp & FetchPref & FetchFact & FetchGeneral --> Retriever["Retriever Engine"]

    subgraph DataSources["Data Retrieval Sources"]
        SDKMsgCache["SDK Message Cache (telegenie-sdk-cache_accountSlot)"]
        SemanticMem["Semantic Memories (telegenie-memory_accountSlot)"]
        DialogPreset["Dialog Preset (telegenie-agent_accountSlot)"]
    end

    Retriever --> SDKMsgCache
    Retriever --> SemanticMem
    Retriever --> DialogPreset

    Retriever --> ContextBuilder["ContextBuilder.build()"]

    subgraph Directives["Prompt Directives & Personas"]
        UserMd["USER.md Profile & Background"]
        ToneConfig["Tone Directive (e.g. Concise, Casual, Formal)"]
        ActiveSkills["Active Skills Instructions"]
        TaskPreset["Task Preset Prompt"]
    end

    UserMd & ToneConfig & ActiveSkills & TaskPreset --> ContextBuilder
    ContextBuilder --> FinalSystemPrompt["Final Structured System Prompt"]
    FinalSystemPrompt --> GenerateNode["generateNode: Stream LLM Response"]
```

---

### 4. Worker Initialization & Stale Run Cleanup

At tab startup, the worker initializes its IndexedDB instances and cascades cleanup of stale agent history.

```mermaid
flowchart TD
    Start(["Worker Boot: agent.worker.ts"]) --> ResolveTabId["resolveWorkerAccountSlot() & resolveWorkerTabId() (Extract from self.name)"]
    ResolveTabId --> InitAgent["initAgentWorker(accountSlot, tabId)"]

    subgraph DBInit["Database Initialization"]
        OpenMemDb["Open MemoryDb (telegenie-memory_accountSlot)"]
        OpenAgentDb["Open AgentDb (telegenie-agent_accountSlot)"]
        OpenMemDb --> OpenAgentDb
    end

    InitAgent --> DBInit
    DBInit --> Cleanup["cleanupAgentDb(agentDb)"]

    subgraph PruneLogic["30-Day TTL Pruning"]
        FindRuns["Find agent_runs where startedAt < (now - 30 days)"]
        DeleteRuns["Delete stale agent_runs"]
        CascadeMessages["Cascade delete orphaned agent_messages"]
        CascadeTools["Cascade delete orphaned tool_calls"]
        CascadeCheckpoints["Cascade delete orphaned agent_checkpoints"]

        FindRuns --> DeleteRuns --> CascadeMessages --> CascadeTools --> CascadeCheckpoints
    end

    Cleanup --> PruneLogic
    PruneLogic --> WireServices["Initialize Retriever, Repositories, & Graph Nodes"]
    WireServices --> ExposeRPC["exposeWorkerApi(AgentWorkerApi)"]
    ExposeRPC --> ListenBridge["attachTabPageBridgeListener (Connect TabPageApi port)"]
    ListenBridge --> Ready(["Worker Ready for RPC Invocations"])
```

---

## Key Components Directory

### Worker & RPC Communication

| File | Purpose |
|---|---|
| [`agent.worker.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/worker/agent.worker.ts) | DedicatedWorker entry point. Bootstraps databases, exposes `AgentWorkerApi`, attaches `agent-page` bridge. |
| [`agent-worker-init.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/worker/agent-worker-init.ts) | Initializes `MemoryDb`, `AgentDb`, repositories, retriever, and handles `configureAgentModel()`. |
| [`agent.api.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/worker/agent.api.ts) | Type definitions for `AgentWorkerApi` (tab &rarr; agent) and `AgentWorkerEvents`. |
| [`agent.handlers.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/worker/agent.handlers.ts) | RPC handler implementations (`chat`, `processNewMessages`, `configureModel`, presets, runs). |
| [`tab-page-client.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/worker/tab-page-client.ts) | Manages the worker-rpc client for `TabPageApi` over the reverse MessageChannel. |
| [`page-bridge-protocol.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/worker/page-bridge-protocol.ts) | Handshake protocol (`agent-page.init`) for transferring the `TabPageApi` port from the page. |

### LangGraph Agent Pipeline

| File | Purpose |
|---|---|
| [`graph.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/agent/graph.ts) | LangGraph StateGraph definition: `understand` &rarr; `retrieve` &rarr; `generate` &rarr; `END`. |
| [`nodes.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/agent/nodes.ts) | Implementation of graph nodes (`understandNode`, `retrieveNode`, `generateNode`). |
| [`state.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/agent/state.ts) | `AgentGraphState` annotations (messages, intent, retrieved context, presets, run metadata). |
| [`models.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/agent/models.ts) | Dynamic chat model factory supporting multi-provider LLMs (OpenAI, Anthropic, Gemini, Groq, Ollama). |
| [`prompts.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/agent/prompts.ts) | System prompts, intent classification prompts, and context prompt formatting. |
| [`checkpointer.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/agent/checkpointer.ts) | State checkpointer setup using `MemorySaver` for conversational threads. |

### Memory Engine

| File | Purpose |
|---|---|
| [`memory-engine.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/memory/engine/memory-engine.ts) | Orchestrator for processing batches of Telegram messages into semantic memories. |
| [`candidate-detector.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/memory/engine/candidate-detector.ts) | Fast regex-based filter to prevent sending irrelevant messages to the LLM. |
| [`memory-extractor.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/memory/engine/memory-extractor.ts) | LLM-based structured extraction conforming to `ExtractionCandidateSchema` (Zod). |
| [`entity-resolver.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/memory/engine/entity-resolver.ts) | Normalizes entity names and maps them to Telegram peer IDs. |
| [`memory-consolidator.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/memory/engine/memory-consolidator.ts) | Enforces dedup, supersedes outdated facts, and records `MemorySource` references. |

### Runtime & Retrieval

| File | Purpose |
|---|---|
| [`retriever.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/runtime/retriever.ts) | Searches across `telegenie-sdk-cache_*` (messages) and `telegenie-memory_*` (facts/preferences). |
| [`context-builder.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/runtime/context-builder.ts) | Formats retrieved memories, dialogue turns, tone directives, and user identity into prompt context. |
| [`preset.service.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/preset/preset.service.ts) | Service providing built-in task presets (e.g., Code Reviewer, Summarizer) and custom user presets. |

### Storage & Repositories

| File / Directory | Purpose |
|---|---|
| [`agent-db/`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/agent-db) | Per-tab IndexedDB (`telegenie-agent_${tabId}`). Stores `agent_runs`, `agent_messages`, `tool_calls`, `agent_checkpoints`, `dialog_presets`. |
| [`agent-db/cleanup.ts`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/agent-db/cleanup.ts) | Startup purge utility for 7-day TTL expiration of runs and child records. |
| [`memory/db/`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/memory/db) | Shared account-level IndexedDB (`telegenie-memory_${accountSlot}`). Stores `entities`, `memories`, `memory_sources`, `embeddings`, `dialog_memory_sync`. |
| [`memory/repository/`](file:///Users/mark/study/project/aicomfine/telegenie/packages/agent/src/memory/repository) | Typed data access layers for memory CRUD, entity resolution, and synchronization tracking. |

