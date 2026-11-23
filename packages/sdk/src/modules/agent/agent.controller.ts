import type {
  AgentMessageForwardContext,
  AgentMessageMediaContext,
  AgentMessageMention,
  AgentMessageRecord,
  AgentMessageReplyContext,
  DialogMemoryContext,
  DialogMemorySync,
  DialogParticipantInfo,
  InputCompletionRequest,
  InputCompletionResult,
} from '@telegenie/agent/worker';
import { z } from 'zod';
import { createLazyAgentWorkerClient, type AgentWorkerClient } from '@telegenie/agent/worker';
import { createDefaultAgentWorker } from '@telegenie/agent/worker/create-default-agent-worker';
import {
  AI_KEY_STORAGE_KEY_PREFIX,
  DEFAULT_MODEL_ID,
  resolveModelProvider,
} from '@telegenie/config';
import { Controller, Method, RequestLog, getTabId } from '@telegenie/decorators';
import {
  TAB_MSG,
  type BroadcastBus,
  type TabMemoryGraphUpdatedPayload,
  type TabMemorySyncCompletePayload,
  type TabMemorySyncProgressPayload,
  type TabMemorySyncRequestPayload,
} from '@telegenie/libs/foundation/broadcast-channel';
import type {
  TypeMessageEntity,
  TypeMessageFwdHeader,
  TypeMessageMedia,
  TypeMessageReplyHeader,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import type { LoadHistoryOptions } from '@telegenie/libs/foundation/telegram/worker';
import type {
  TabPageToolCallEvent,
  TabPageToolContext,
  TabPageToolDescriptor,
  TabPageToolResult,
  TabPageToolScope,
  UpdateUiStatePayload,
} from '@telegenie/libs/types/tab-page.api';
import type GlobalStore from '../../store/global/global.store';
import type StoreManager from '../../store/store.manager';
import type { MessageEntity, MessageStore } from '../../store/types';
import {
  buildReplyPreviewText,
  peerIdFromTypePeer,
  replySenderPeerId,
  resolveMessageReplyHeader,
} from '../../store/utils/message-reply';
import { dialogPeerKindFromId } from '../../store/utils/peer-display';
import { TabPage } from './tab-page';

export type AgentControllerLoadHistoryResult = {
  messages: Array<{
    id: number | string;
    date: number;
    message?: string;
    out?: boolean;
    fromId?: string;
    from_id?: unknown;
    isEmpty?: boolean;
    replyTo?: TypeMessageReplyHeader;
    entities?: TypeMessageEntity[];
    fwdFrom?: TypeMessageFwdHeader;
    media?: TypeMessageMedia;
  }>;
  count?: number;
};

export type AgentControllerOptions = {
  createWorkerClient?: () => AgentWorkerClient;
  /** Per-tab identifier (e.g. from tab leader election or sessionStorage). */
  tabId?: string;
  getTabId?: () => string;
  /** Account slot identifier (scoped per user/account). */
  accountSlot?: string;
  getAccountSlot?: () => string;
  /** Proxy Telegram auth check via the tab's SharedWorker client. */
  telegramIsAuthorized?: () => Promise<boolean>;
  /** Apply agent-driven UI updates on this tab. */
  updateUiState?: (payload: UpdateUiStatePayload) => void;
  /** Receive streaming LLM tokens from the agent worker. */
  onStreamToken?: (runId: string, token: string) => void;
  /** Returns true if this tab is currently the leader. Used to gate Memory Engine calls. */
  isLeader?: () => boolean;
  /** Returns the base URL for the TeleGenie Cloud backend. */
  getBackendBaseUrl?: () => string;
  /** Returns the active JWT token for TeleGenie Cloud. */
  getBackendToken?: () => string | null;
  /** Cross-tab coordination bus. */
  broadcast?: BroadcastBus;
  /** Global store for dialog metadata. */
  globalStore?: GlobalStore;
  /** Store manager for looking up user/chat/channel display metadata. */
  storeManager?: StoreManager;
  /** Load history function to fetch older/newer messages for memory extraction. */
  loadHistory?: (peerId: string, opts: LoadHistoryOptions) => Promise<AgentControllerLoadHistoryResult>;
  /** SDK cache IndexedDB reader to retrieve all persisted messages for a peer. */
  loadCachedMessagesByPeer?: (peerId: string) => Promise<MessageEntity[]>;
  /** Message store getter to retrieve locally cached messages. */
  ensureMessageStore?: (peerId: string) => MessageStore;
};

export type TabToolDefinition<TSchema extends z.ZodType = z.ZodType> = {
  name: string;
  description: string;
  parameters: TSchema;
  /** Controls which agent flows expose this tool. Defaults to `'chat'`. */
  scope?: TabPageToolScope;
};

export type TabToolHandler<TArgs = Record<string, unknown>> = (
  args: TArgs,
  context: TabPageToolContext,
) => unknown | Promise<unknown>;

export type CompleteInputOptions = {
  peerId: string;
  currentInput: string;
  replyToMessageId?: string;
  editingMessageId?: string;
  model?: string;
  maxOptions?: number;
};

type RegisteredTabToolEntry = {
  descriptor: TabPageToolDescriptor;
  schema: z.ZodType;
  handler: TabToolHandler<unknown>;
};

export const INCREMENTAL_SYNC_BATCH_SIZE = 50;
export const INCREMENTAL_SYNC_INTERVAL_MS = 60_000;

/**
 * SDK façade for the per-tab agent DedicatedWorker + tab-page API host.
 */
@Controller
export class AgentController {
  private readonly worker: AgentWorkerClient;
  private readonly tabPage: TabPage;
  private readonly isLeader: () => boolean;
  private readonly getBackendBaseUrl?: () => string;
  private readonly getBackendToken?: () => string | null;
  private readonly broadcast?: BroadcastBus;
  private readonly globalStore?: GlobalStore;
  private readonly storeManager?: StoreManager;
  private readonly loadHistory?: (peerId: string, opts: LoadHistoryOptions) => Promise<AgentControllerLoadHistoryResult>;
  private readonly loadCachedMessagesByPeer?: (peerId: string) => Promise<MessageEntity[]>;
  private readonly ensureMessageStore?: (peerId: string) => MessageStore;

  private readonly streamTokenListeners = new Set<(runId: string, token: string) => void>();
  private readonly toolCallEventListeners = new Set<(event: TabPageToolCallEvent) => void>();
  private readonly registeredTools = new Map<string, RegisteredTabToolEntry>();
  private bridgeConnected = false;
  private readonly activeSyncs = new Map<string, { status: 'syncing' | 'completed' | 'failed'; processed: number }>();
  private readonly syncProgressListeners = new Set<(payload: TabMemorySyncProgressPayload) => void>();
  private readonly syncCompleteListeners = new Set<(payload: TabMemorySyncCompletePayload) => void>();

  private readonly incrementalQueues = new Map<string, Map<string, AgentMessageRecord>>();
  private readonly incrementalTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly isFlushingIncremental = new Set<string>();
  private readonly getAccountSlotFn?: () => string;
  private readonly explicitAccountSlot?: string;
  private memoryGraphRevision = 0;
  private isModelConfigured = false;

  constructor(options: AgentControllerOptions = {}) {
    this.explicitAccountSlot = options.accountSlot;
    this.getAccountSlotFn = options.getAccountSlot;
    this.worker =
      options.createWorkerClient?.() ??
      createLazyAgentWorkerClient(() => {
        const tabId = options.tabId ?? options.getTabId?.() ?? getTabId();
        const accountSlot = options.accountSlot ?? options.getAccountSlot?.() ?? 'default';
        return createDefaultAgentWorker({ tabId, accountSlot });
      });

    this.isLeader = options.isLeader ?? (() => false);
    this.getBackendBaseUrl = options.getBackendBaseUrl;
    this.getBackendToken = options.getBackendToken;
    this.broadcast = options.broadcast;
    this.globalStore = options.globalStore;
    this.storeManager = options.storeManager;
    this.loadHistory = options.loadHistory;
    this.loadCachedMessagesByPeer = options.loadCachedMessagesByPeer;
    this.ensureMessageStore = options.ensureMessageStore;

    if (this.broadcast) {
      this.broadcast.on<TabMemorySyncRequestPayload>(TAB_MSG.memorySyncRequest, (env) => {
        if (this.isLeader() && env.payload?.peerId) {
          void this.executeFullSync(env.payload.peerId, env.payload.fromDate, env.payload.toDate);
        }
      });

      this.broadcast.on<TabMemorySyncProgressPayload>(TAB_MSG.memorySyncProgress, (env) => {
        const p = env.payload;
        if (p?.peerId) {
          this.activeSyncs.set(p.peerId, { status: p.status, processed: p.processed });
          for (const listener of this.syncProgressListeners) {
            listener(p);
          }
        }
      });

      this.broadcast.on<TabMemorySyncCompletePayload>(TAB_MSG.memorySyncComplete, (env) => {
        const p = env.payload;
        if (p?.peerId) {
          this.activeSyncs.delete(p.peerId);
          for (const listener of this.syncCompleteListeners) {
            listener(p);
          }
        }
      });

      this.broadcast.on<TabMemoryGraphUpdatedPayload>(TAB_MSG.memoryGraphUpdated, (env) => {
        if (!this.isLeader() && env.payload?.accountSlot === this.resolveAccountSlot()) {
          void this.worker.call('invalidateMemoryGraph', []).catch(() => undefined);
        }
      });
    }

    this.tabPage = new TabPage({
      telegramIsAuthorized:
        options.telegramIsAuthorized ?? (async () => false),
      updateUiState: options.updateUiState ?? (() => undefined),
      onStreamToken: (runId, token) => {
        options.onStreamToken?.(runId, token);
        for (const listener of this.streamTokenListeners) {
          listener(runId, token);
        }
      },
      onInvokeTool: async (name, rawArgs, context) => {
        return this.invokeRegisteredTool(name, rawArgs, context);
      },
      onToolCallEvent: (event) => {
        for (const listener of this.toolCallEventListeners) {
          try {
            listener(event);
          } catch (err) {
            console.error('[AgentController] Error in toolCallEvent listener:', err);
          }
        }
      },
    });
  }

  /**
   * Subscribe to real-time streaming LLM tokens pushed from the agent worker.
   */
  @Method()
  onStreamToken(listener: (runId: string, token: string) => void): () => void {
    this.streamTokenListeners.add(listener);
    return () => {
      this.streamTokenListeners.delete(listener);
    };
  }

  /**
   * Subscribe to live tool-call lifecycle events (`start` / `result` / `error`) pushed from the agent worker.
   */
  @Method()
  onToolCallEvent(listener: (event: TabPageToolCallEvent) => void): () => void {
    this.toolCallEventListeners.add(listener);
    return () => {
      this.toolCallEventListeners.delete(listener);
    };
  }

  /**
   * Register a tab-page tool with a Zod v4 schema and handler.
   * Serializes the schema to JSON Schema and syncs descriptors to the agent worker.
   * Returns an idempotent unregister function suitable for React `useEffect` cleanup.
   */
  @Method()
  registerTool<TSchema extends z.ZodType>(
    definition: TabToolDefinition<TSchema>,
    handler: TabToolHandler<z.infer<TSchema>>,
  ): () => void {
    const name = definition.name.trim();
    if (!name) {
      throw new Error('Tool name must be a non-empty string.');
    }

    const jsonSchema = z.toJSONSchema(definition.parameters) as Record<string, unknown>;
    const descriptor: TabPageToolDescriptor = {
      name,
      description: definition.description,
      parameters: jsonSchema,
      ...(definition.scope ? { scope: definition.scope } : {}),
    };

    const entry: RegisteredTabToolEntry = {
      descriptor,
      schema: definition.parameters,
      handler: handler as TabToolHandler<unknown>,
    };
    this.registeredTools.set(name, entry);

    if (this.bridgeConnected) {
      void this.syncTabTools().catch((err) => {
        console.warn(`[AgentController] Failed to sync tab tools after registering "${name}":`, err);
      });
    }

    return () => {
      // Only remove if this exact registration is still active (React StrictMode safe)
      if (this.registeredTools.get(name) === entry) {
        this.registeredTools.delete(name);
        if (this.bridgeConnected) {
          void this.syncTabTools().catch(() => {});
        }
      }
    };
  }

  /**
   * Unregister a previously registered tab-page tool by name and sync to the agent worker.
   */
  @Method()
  unregisterTool(name: string): void {
    if (!this.registeredTools.delete(name)) return;
    if (this.bridgeConnected) {
      void this.syncTabTools().catch(() => {});
    }
  }

  private readonly syncTabTools = async (): Promise<void> => {
    const descriptors = Array.from(this.registeredTools.values()).map((entry) => entry.descriptor);
    await this.worker.call('setTabTools', [descriptors]);
  };

  private readonly invokeRegisteredTool = async (
    name: string,
    rawArgs: Record<string, unknown>,
    context: TabPageToolContext,
  ): Promise<TabPageToolResult> => {
    const entry = this.registeredTools.get(name);
    if (!entry) {
      return { ok: false, error: `Tool "${name}" is not registered on this tab.` };
    }

    const parsed = entry.schema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      return {
        ok: false,
        error: `Invalid arguments for tool "${name}": ${parsed.error.message}`,
      };
    }

    try {
      const result = await entry.handler(parsed.data, context);
      return { ok: true, result };
    } catch (err) {
      return {
        ok: false,
        error: (err as Error)?.message || `Tool "${name}" execution failed.`,
      };
    }
  };

  /**
   * Spawn the agent worker (if needed) and expose TabPageApi over an
   * `agent-page` MessageChannel so the worker can call back into this tab.
   */
  @RequestLog()
  @Method()
  async connectPageBridge(): Promise<void> {
    // Force lazy client to construct the DedicatedWorker, then transfer the page port.
    const agentWorker = this.worker.worker;
    this.tabPage.connect(agentWorker);
    this.bridgeConnected = true;
    if (this.registeredTools.size > 0) {
      await this.syncTabTools();
    }
  }

  @RequestLog()
  @Method()
  disconnectPageBridge(): void {
    this.bridgeConnected = false;
    this.tabPage.disconnect();
    for (const timer of this.incrementalTimers.values()) {
      clearTimeout(timer);
    }
    this.incrementalTimers.clear();
  }

  /** Demo: tab → agent ping. */
  @RequestLog()
  @Method()
  ping(): Promise<'pong'> {
    return this.worker.call('ping', []);
  }

  /** Demo: tab → agent → tab round-trip via TabPageApi.ping. */
  @RequestLog()
  @Method()
  demoRoundTrip(): Promise<'pong'> {
    return this.worker.call('demoRoundTrip', []);
  }

  /**
   * Run the agent on a user message and return the response string.
   * Supports options ({ peerId, model, presetId }) or legacy peerId string.
   * Invokes the compiled LangGraph graph with IndexedDB persistence.
   */
  @RequestLog()
  @Method()
  chat(
    userMessage: string,
    options?: string | import('@telegenie/agent/worker').ChatOptions,
  ): Promise<import('@telegenie/agent/worker').ChatResult> {
    return this.worker.call('chat', [userMessage, options]);
  }

  /**
   * Request multiple contextual message completions for the active composer input
   * (triggered on Tab in MessageComposer). Context (recent messages, reply-to/editing
   * messages, dialog participants, preset, and memories) is assembled inside the agent worker.
   */
  @RequestLog()
  @Method()
  async completeInput(options: CompleteInputOptions): Promise<InputCompletionResult> {
    await this.ensureModelConfigured();
    if (this.bridgeConnected && this.registeredTools.size > 0) {
      await this.syncTabTools();
    }

    const request: InputCompletionRequest = {
      peerId: options.peerId,
      currentInput: options.currentInput,
      model: options.model ?? this.getSelectedModel(),
      ...(options.replyToMessageId ? { replyToMessageId: options.replyToMessageId } : {}),
      ...(options.editingMessageId ? { editingMessageId: options.editingMessageId } : {}),
      ...(options.maxOptions ? { maxOptions: options.maxOptions } : {}),
    };

    return this.worker.call('completeInput', [request]);
  }

  /**
   * Configure the LLM used by the agent worker.
   * Can pass { provider, model, apiKey, apiKeys, proxy } or (apiKey, model).
   * Automatically enriches with proxy configuration when no personal API key is supplied.
   */
  @RequestLog()
  @Method()
  configureModel(
    configOrApiKey: string | import('@telegenie/agent/worker').ModelConfig,
    model?: string,
  ): Promise<void> {
    console.log('=================configureModel==============');
    this.isModelConfigured = true;
    if (typeof configOrApiKey === 'object' && configOrApiKey !== null) {
      const enrichedConfig = { ...configOrApiKey };
      if (!enrichedConfig.proxy && this.getBackendBaseUrl) {
        const baseUrl = this.getBackendBaseUrl();
        const token = this.getBackendToken?.() ?? undefined;
        if (baseUrl) {
          enrichedConfig.proxy = {
            baseUrl,
            token: token || undefined,
          };
        }
      }
      return this.worker.call('configureModel', [enrichedConfig, model]);
    }
    return this.worker.call('configureModel', [configOrApiKey, model]);
  }

  /**
   * Ensure that the worker has its LLM model and MemoryEngine configured.
   * Pulls the selected model from globalStore, BYOK keys from localStorage,
   * and auto-enriches proxy settings from backend base URL / token.
   */
  @RequestLog()
  @Method()
  async ensureModelConfigured(): Promise<void> {
    if (this.isModelConfigured) return;

    const model = this.getSelectedModel();
    const provider = resolveModelProvider(model);
    const apiKeys: { google?: string; anthropic?: string; openai?: string } = {};

    if (typeof localStorage !== 'undefined') {
      try {
        apiKeys.google =
          localStorage.getItem(`${AI_KEY_STORAGE_KEY_PREFIX}google`) ||
          localStorage.getItem(`${AI_KEY_STORAGE_KEY_PREFIX}Google`) ||
          undefined;
        apiKeys.anthropic =
          localStorage.getItem(`${AI_KEY_STORAGE_KEY_PREFIX}anthropic`) ||
          localStorage.getItem(`${AI_KEY_STORAGE_KEY_PREFIX}Anthropic`) ||
          undefined;
        apiKeys.openai =
          localStorage.getItem(`${AI_KEY_STORAGE_KEY_PREFIX}openai`) ||
          localStorage.getItem(`${AI_KEY_STORAGE_KEY_PREFIX}OpenAI`) ||
          undefined;
      } catch {
        // Ignore localStorage access errors
      }
    }

    await this.configureModel({
      provider,
      model,
      apiKeys,
    });
    this.isModelConfigured = true;
  }

  /** Configure installed skills available to the agent. */
  @RequestLog()
  @Method()
  configureSkills(skills: import('@telegenie/agent/worker').GenieSkill[]): Promise<void> {
    return this.worker.call('configureSkills', [skills]);
  }

  /** Configure the user identity (conforming to USER.md) for the agent. */
  @RequestLog()
  @Method()
  configureUserIdentity(identity: string): Promise<void> {
    return this.worker.call('configureUserIdentity', [identity]);
  }

  /** Get user-configured preset for a specific dialog. */
  @RequestLog()
  @Method()
  getDialogPreset(peerId: string) {
    return this.worker.call('getDialogPreset', [peerId]);
  }

  /** Save/update user-configured preset for a specific dialog. */
  @RequestLog()
  @Method()
  setDialogPreset(preset: import('@telegenie/agent/worker').DialogPreset) {
    return this.worker.call('setDialogPreset', [preset]);
  }

  /** Delete user-configured preset for a specific dialog. */
  @RequestLog()
  @Method()
  deleteDialogPreset(peerId: string) {
    return this.worker.call('deleteDialogPreset', [peerId]);
  }

  /** Get recent conversation runs stored in IndexedDB. */
  @RequestLog()
  @Method()
  getRecentRuns(limit?: number): Promise<import('@telegenie/agent/worker').AgentRun[]> {
    return this.worker.call('getRecentRuns', [limit]);
  }

  /** Get all messages for a specific conversation run from IndexedDB. */
  @RequestLog()
  @Method()
  getRunMessages(runId: string): Promise<import('@telegenie/agent/worker').AgentMessage[]> {
    return this.worker.call('getRunMessages', [runId]);
  }

  /** Update the title of an agent run in IndexedDB. */
  @RequestLog()
  @Method()
  updateRunTitle(runId: string, title: string): Promise<void> {
    return this.worker.call('updateRunTitle', [runId, title]);
  }

  /** Generate an AI summary title for an agent run and persist it. */
  @RequestLog()
  @Method()
  generateRunTitle(
    runId: string,
    options?: { apiKeys?: import('@telegenie/agent/worker').ModelConfig['apiKeys']; model?: string },
  ): Promise<string> {
    return this.worker.call('generateRunTitle', [runId, options]);
  }

  /** Get all available presets (builtin + user custom). */
  @RequestLog()
  @Method()
  getPresets(): Promise<import('@telegenie/agent/worker').AgentPreset[]> {
    return this.worker.call('getPresets', []);
  }

  /** Save a custom preset. */
  @RequestLog()
  @Method()
  savePreset(preset: import('@telegenie/agent/worker').AgentPreset): Promise<void> {
    return this.worker.call('savePreset', [preset]);
  }

  /**
   * Forward new Telegram messages to the Memory Engine.
   * LEADER TAB ONLY — follower tabs must not call this.
   * The caller is responsible for checking isLeader() before invoking.
   */
  @RequestLog()
  @Method()
  async processNewMessages(
    messages: AgentMessageRecord[],
    dialogContext?: DialogMemoryContext,
  ): Promise<void> {
    if (!this.isLeader()) return;
    await this.ensureModelConfigured();
    const peerId = dialogContext?.peerId ?? messages[0]?.peerId;
    const resolvedContext =
      dialogContext ?? (peerId ? this.buildDialogMemoryContext(peerId, messages) : undefined);
    await this.worker.call('processNewMessages', [messages, resolvedContext]);
    this.broadcastMemoryGraphUpdated(peerId);
  }

  private resolveAccountSlot(): string {
    return this.explicitAccountSlot ?? this.getAccountSlotFn?.() ?? 'default';
  }

  private broadcastMemoryGraphUpdated(peerId?: string): void {
    this.memoryGraphRevision += 1;
    this.broadcast?.post(TAB_MSG.memoryGraphUpdated, {
      accountSlot: this.resolveAccountSlot(),
      revision: this.memoryGraphRevision,
      ...(peerId ? { peerId } : {}),
    });
  }

  /** Get memory sync record for a specific dialog. */
  @RequestLog()
  @Method()
  getDialogMemorySync(peerId: string): Promise<DialogMemorySync | undefined> {
    return this.worker.call('getDialogMemorySync', [peerId]);
  }

  /** Get all dialog memory sync records across the account. */
  @RequestLog()
  @Method()
  getAllDialogMemorySyncs(): Promise<DialogMemorySync[]> {
    return this.worker.call('getAllDialogMemorySyncs', []);
  }

  /** Toggle incremental memory extraction for a specific dialog. */
  @RequestLog()
  @Method()
  setIncrementalMemorySync(peerId: string, enabled: boolean): Promise<DialogMemorySync> {
    return this.worker.call('setIncrementalMemorySync', [peerId, enabled]);
  }

  /** Returns true if a dialog is currently syncing memory. */
  @Method()
  isSyncing(peerId: string): boolean {
    return this.activeSyncs.get(peerId)?.status === 'syncing';
  }

  /** Subscribe to live sync progress updates. */
  @Method()
  onMemorySyncProgress(listener: (payload: TabMemorySyncProgressPayload) => void): () => void {
    this.syncProgressListeners.add(listener);
    return () => this.syncProgressListeners.delete(listener);
  }

  /** Subscribe to sync completion updates. */
  @Method()
  onMemorySyncComplete(listener: (payload: TabMemorySyncCompletePayload) => void): () => void {
    this.syncCompleteListeners.add(listener);
    return () => this.syncCompleteListeners.delete(listener);
  }

  /**
   * Set the active AI model in the global agent store.
   */
  @RequestLog()
  @Method()
  setSelectedModel(model: string): void {
    this.globalStore?.agent.setSelectedModel(model);
    this.isModelConfigured = false;
    void this.ensureModelConfigured().catch((err) => {
      console.warn('[AgentController] Failed to auto-configure model on change:', err);
    });
  }

  /**
   * Get the active AI model from the global agent store.
   */
  @Method()
  getSelectedModel(): string {
    return this.globalStore?.agent?.selectedModel ?? DEFAULT_MODEL_ID;
  }

  /**
   * Check whether the user has sufficient credits or BYOK keys for the selected model.
   * If the user provided API keys for the model's provider, bypass credit check.
   * If not, check their credit balance in the global auth profile.
   */
  @Method()
  hasCredit(model?: string): boolean {
    const targetModel = model ?? this.globalStore?.agent?.selectedModel ?? DEFAULT_MODEL_ID;
    const provider = resolveModelProvider(targetModel);

    // If the user has provided API keys for that provider, bypass credit check
    if (typeof localStorage !== 'undefined') {
      try {
        const key = localStorage.getItem(`${AI_KEY_STORAGE_KEY_PREFIX}${provider.toLowerCase()}`);
        if (key && key.trim().length > 0) {
          return true;
        }
      } catch {
        // Ignore localStorage access errors
      }
    }

    // If not, check their credit balance in auth profile
    const profile = this.globalStore?.auth?.backendUserProfile;
    if (!profile) return false;
    return (profile.credits?.totalAvailable ?? 0) > 0;
  }

  /**
   * Trigger full memory extraction for a dialog across the selected date range.
   * Coordinated via BroadcastChannel to run on the elected leader tab.
   */
  @RequestLog()
  @Method()
  async syncDialogMemory(peerId: string, options: { fromDate: number; toDate: number }): Promise<void> {
    if (this.isSyncing(peerId)) return;

    if (!this.hasCredit()) {
      throw new Error('Insufficient AI credits to perform memory extraction.');
    }

    await this.ensureModelConfigured();

    if (!this.isLeader()) {
      this.activeSyncs.set(peerId, { status: 'syncing', processed: 0 });
      this.broadcast?.post(TAB_MSG.memorySyncRequest, {
        peerId,
        fromDate: options.fromDate,
        toDate: options.toDate,
      });
      return;
    }

    await this.executeFullSync(peerId, options.fromDate, options.toDate);
  }

  private notifySyncProgress(payload: TabMemorySyncProgressPayload): void {
    this.activeSyncs.set(payload.peerId, { status: payload.status, processed: payload.processed });
    for (const listener of this.syncProgressListeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error('[AgentController] Error in syncProgress listener:', err);
      }
    }
    this.broadcast?.post(TAB_MSG.memorySyncProgress, payload);
  }

  private notifySyncComplete(payload: TabMemorySyncCompletePayload): void {
    this.activeSyncs.delete(payload.peerId);
    for (const listener of this.syncCompleteListeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error('[AgentController] Error in syncComplete listener:', err);
      }
    }
    this.broadcast?.post(TAB_MSG.memorySyncComplete, payload);
  }

  /**
   * Leader-only full sync execution: collects messages local-first,
   * throttles Telegram history pagination, processes batches with AI credit attribution,
   * updates IDB DialogMemorySync, and notifies all tabs.
   */
  private async executeFullSync(peerId: string, fromDate: number, toDate: number): Promise<void> {
    if (this.activeSyncs.get(peerId)?.status === 'syncing') return;

    if (!this.hasCredit()) {
      this.notifySyncProgress({
        peerId,
        status: 'failed',
        processed: 0,
        memoriesCreated: 0,
        error: 'Insufficient AI credits to perform memory extraction.',
      });
      this.notifySyncComplete({
        peerId,
        totalSynced: 0,
        status: 'failed',
        error: 'Insufficient AI credits to perform memory extraction.',
      });
      return;
    }

    this.notifySyncProgress({
      peerId,
      processed: 0,
      memoriesCreated: 0,
      status: 'syncing',
    });

    let totalProcessed = 0;
    let totalMemoriesCreated = 0;

    try {
      await this.ensureModelConfigured();
      await this.worker.call('upsertDialogMemorySync', [
        { peerId, status: 'syncing', fromDate, toDate },
      ]);

      // 1. Local-first: collect cached messages in [fromDate, toDate] directly from IndexedDB
      const collectedMessages = new Map<number, AgentMessageRecord>();
      const cachedMessages = (await this.loadCachedMessagesByPeer?.(peerId)) ?? [];
      const cachedMessageById = new Map<string, MessageEntity>();
      for (const msg of cachedMessages) {
        if (msg?.id != null) {
          cachedMessageById.set(String(msg.id), msg);
        }
      }
      const replyLookupStore = {
        get: (id: string) => cachedMessageById.get(id),
      } as unknown as MessageStore;

      for (const msg of cachedMessages) {
        const numId = Number(msg?.id);
        if (!numId || !msg || msg.isEmpty) continue;
        const record = this.toAgentMessageRecord(peerId, msg, replyLookupStore);
        if (!record.message?.trim() && !record.media?.summary?.trim()) continue;
        const msgDateMs = (msg.date ?? 0) * 1000;
        if (msgDateMs >= fromDate && msgDateMs <= toDate) {
          collectedMessages.set(numId, record);
        }
      }

      // Find the oldest message id we have locally
      let oldestId = Infinity;
      for (const id of collectedMessages.keys()) {
        if (id < oldestId) oldestId = id;
      }

      // 2. If range extends older than what's cached and we have loadHistory, paginate backwards
      if (this.loadHistory) {
        let currentOffsetId: number | undefined =
          Number.isFinite(oldestId) && oldestId > 1 ? oldestId : undefined;
        let reachedStart = false;

        if (
          Number.isFinite(oldestId) &&
          collectedMessages.get(oldestId) &&
          (collectedMessages.get(oldestId)!.date * 1000) <= fromDate
        ) {
          reachedStart = true;
        }

        while (!reachedStart) {
          // Throttling to prevent Telegram rate limit
          await new Promise((resolve) => setTimeout(resolve, 150));

          const result = await this.loadHistory(peerId, {
            direction: 'backwards',
            offsetId: currentOffsetId,
            limit: 50,
          });

          if (!result || !result.messages || result.messages.length === 0) {
            break;
          }

          let newMessagesAdded = 0;
          for (const msg of result.messages) {
            const rawMsg = msg as any;
            if (!msg || rawMsg.isEmpty) continue;
            const msgDateMs = (msg.date ?? 0) * 1000;
            const numId = Number(msg.id);
            if (!numId) continue;
            if (msgDateMs < fromDate) {
              reachedStart = true;
            } else if (msgDateMs <= toDate) {
              const storedMsg = cachedMessageById.get(String(numId));
              const record = this.toAgentMessageRecord(
                peerId,
                storedMsg ?? rawMsg,
                replyLookupStore,
              );
              if (record.message?.trim() || record.media?.summary?.trim()) {
                collectedMessages.set(numId, record);
                newMessagesAdded++;
              }
            }
            if (currentOffsetId === undefined || numId < currentOffsetId) {
              currentOffsetId = numId;
            }
          }

          if (result.messages.length < 50 || (currentOffsetId !== undefined && currentOffsetId <= 1)) {
            break;
          }
        }
      }

      // 3. Sort chronologically
      const sortedRecords = Array.from(collectedMessages.values()).sort(
        (a, b) => a.date - b.date || a.id.localeCompare(b.id, undefined, { numeric: true }),
      );

      // 4. Process in chunks of 20 with 'memory extraction' cost source and scoped DialogMemoryContext
      const CHUNK_SIZE = 20;
      for (let i = 0; i < sortedRecords.length; i += CHUNK_SIZE) {
        const chunk = sortedRecords.slice(i, i + CHUNK_SIZE);
        const dialogContext = this.buildDialogMemoryContext(peerId, chunk);
        const res = await this.worker.call('processMessagesWithCost', [
          chunk,
          'memory extraction',
          dialogContext,
        ]);
        totalProcessed += chunk.length;
        totalMemoriesCreated += res?.memoriesCreated ?? 0;

        this.notifySyncProgress({
          peerId,
          processed: totalProcessed,
          memoriesCreated: totalMemoriesCreated,
          status: 'syncing',
        });
      }

      // 5. Complete
      await this.worker.call('upsertDialogMemorySync', [
        {
          peerId,
          status: 'completed',
          lastSyncAt: Date.now(),
          fromDate,
          toDate,
          syncedMessageCount: totalProcessed,
        },
      ]);

      this.notifySyncComplete({
        peerId,
        totalSynced: totalProcessed,
        status: 'completed',
      });
      this.broadcastMemoryGraphUpdated(peerId);
    } catch (err) {
      const errorMsg = (err as Error).message || 'Full memory extraction failed';
      try {
        await this.worker.call('upsertDialogMemorySync', [
          {
            peerId,
            status: 'failed',
            lastSyncAt: Date.now(),
            error: errorMsg,
          },
        ]);
      } catch (upsertErr) {
        console.error('[AgentController] Failed to persist failed memory sync state:', upsertErr);
      }
      this.notifySyncComplete({
        peerId,
        totalSynced: totalProcessed,
        status: 'failed',
        error: errorMsg,
      });
    }
  }

  /**
   * Handle real-time incoming or outgoing messages for incremental memory extraction.
   * MUST run only on the elected leader tab without blocking.
   * Batches messages per peerId: flushes when reaching 50 messages or every 1 minute.
   */
  @RequestLog()
  @Method()
  async handleIncomingMessage(entity: MessageEntity): Promise<void> {
    if (!this.isLeader()) return;
    if (!entity.peerId || entity.isEmpty) return;

    try {
      const syncRecord = await this.getDialogMemorySync(entity.peerId);
      if (!syncRecord?.incrementalSync) return;

      const messageStore = this.ensureMessageStore?.(entity.peerId);
      const record = this.toAgentMessageRecord(entity.peerId, entity, messageStore);
      if (!record.message?.trim() && !record.media?.summary?.trim()) return;

      await this.enqueueIncrementalMessage(record);
    } catch (err) {
      console.warn('[AgentController] Incremental memory extraction failed:', err);
    }
  }

  private async enqueueIncrementalMessage(record: AgentMessageRecord): Promise<void> {
    const peerId = record.peerId;
    let peerQueue = this.incrementalQueues.get(peerId);
    if (!peerQueue) {
      peerQueue = new Map<string, AgentMessageRecord>();
      this.incrementalQueues.set(peerId, peerQueue);
    }

    peerQueue.set(record.id, record);

    if (peerQueue.size >= INCREMENTAL_SYNC_BATCH_SIZE) {
      await this.flushIncrementalQueue(peerId);
    } else if (!this.incrementalTimers.has(peerId)) {
      const timer = setTimeout(() => {
        this.incrementalTimers.delete(peerId);
        void this.flushIncrementalQueue(peerId);
      }, INCREMENTAL_SYNC_INTERVAL_MS);
      this.incrementalTimers.set(peerId, timer);
    }
  }

  /**
   * Flush pending incremental messages for a peer:
   * Syncs at most 50 messages at once and removes them from the queue.
   * If no messages are in the queue, does nothing.
   */
  @RequestLog()
  @Method()
  async flushIncrementalQueue(peerId: string): Promise<void> {
    if (this.isFlushingIncremental.has(peerId)) return;
    if (!this.isLeader()) return;

    const peerQueue = this.incrementalQueues.get(peerId);
    if (!peerQueue || peerQueue.size === 0) {
      const existingTimer = this.incrementalTimers.get(peerId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.incrementalTimers.delete(peerId);
      }
      return;
    }

    if (!this.hasCredit()) {
      console.warn('[AgentController] Skipping incremental memory extraction: credits exhausted');
      return;
    }

    const existingTimer = this.incrementalTimers.get(peerId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.incrementalTimers.delete(peerId);
    }

    this.isFlushingIncremental.add(peerId);

    const allRecords = Array.from(peerQueue.values());
    const batch = allRecords.slice(0, INCREMENTAL_SYNC_BATCH_SIZE);

    for (const msg of batch) {
      peerQueue.delete(msg.id);
    }

    if (peerQueue.size === 0) {
      this.incrementalQueues.delete(peerId);
    }

    try {
      await this.ensureModelConfigured();
      const dialogContext = this.buildDialogMemoryContext(peerId, batch);
      await this.worker.call('processMessagesWithCost', [
        batch,
        'memory extraction',
        dialogContext,
      ]);
      await this.worker.call('upsertDialogMemorySync', [
        {
          peerId,
          lastSyncAt: Date.now(),
          syncedMessageCount: batch.length,
        },
      ]);
      this.broadcastMemoryGraphUpdated(peerId);
    } catch (err) {
      console.warn('[AgentController] Incremental memory extraction failed:', err);
    } finally {
      this.isFlushingIncremental.delete(peerId);

      const remaining = this.incrementalQueues.get(peerId);
      if (remaining && remaining.size > 0) {
        if (remaining.size >= INCREMENTAL_SYNC_BATCH_SIZE) {
          void this.flushIncrementalQueue(peerId);
        } else if (!this.incrementalTimers.has(peerId)) {
          const timer = setTimeout(() => {
            this.incrementalTimers.delete(peerId);
            void this.flushIncrementalQueue(peerId);
          }, INCREMENTAL_SYNC_INTERVAL_MS);
          this.incrementalTimers.set(peerId, timer);
        }
      }
    }
  }

  /** Flush all queues immediately. */
  @Method()
  async flushAllIncrementalQueues(): Promise<void> {
    const peerIds = Array.from(this.incrementalQueues.keys());
    await Promise.all(peerIds.map((peerId) => this.flushIncrementalQueue(peerId)));
  }

  /** @internal */
  @RequestLog()
  @Method()
  getWorkerClient(): AgentWorkerClient {
    return this.worker;
  }

  // ---------------------------------------------------------------------------
  // Message & Dialog Context Enrichment Helpers
  // ---------------------------------------------------------------------------

  private toAgentMessageRecord(
    peerId: string,
    rawMsg: {
      id: number | string;
      date?: number;
      message?: string;
      out?: boolean;
      fromId?: string;
      from_id?: unknown;
      replyTo?: TypeMessageReplyHeader;
      entities?: TypeMessageEntity[];
      fwdFrom?: TypeMessageFwdHeader;
      media?: TypeMessageMedia;
    },
    messageStore?: MessageStore,
  ): AgentMessageRecord {
    const rawFromId = rawMsg.fromId ?? rawMsg.from_id;
    let fromId: string | undefined;
    if (rawFromId) {
      if (typeof rawFromId === 'object' && rawFromId !== null) {
        const obj = rawFromId as Record<string, unknown>;
        const idVal =
          obj.userId ?? obj.user_id ?? obj.chatId ?? obj.chat_id ?? obj.channelId ?? obj.channel_id;
        fromId = idVal ? String(idVal) : undefined;
      } else {
        fromId = String(rawFromId);
      }
    }

    const currentUser = this.globalStore?.auth.currentUser as { id?: string } | null | undefined;
    if (!fromId && rawMsg.out && currentUser?.id) {
      fromId = String(currentUser.id);
    }

    const text = rawMsg.message ?? '';
    const replyHeader = resolveMessageReplyHeader(rawMsg.replyTo);
    let replyTo: AgentMessageReplyContext | undefined;
    let threadId: string | undefined;

    if (replyHeader) {
      if (replyHeader.forumTopic) {
        const topId = replyHeader.replyToTopId ?? replyHeader.replyToMsgId;
        if (topId != null) {
          threadId = String(topId);
        }
      }
      if (replyHeader.replyToMsgId != null) {
        const targetIdStr = String(replyHeader.replyToMsgId);
        const repliedMsg =
          typeof messageStore?.get === 'function' ? messageStore.get(targetIdStr) : undefined;
        const quoteText = buildReplyPreviewText(replyHeader, repliedMsg);
        const replyFromId = replySenderPeerId(replyHeader.replyFrom, repliedMsg);
        replyTo = {
          messageId: targetIdStr,
          ...(replyFromId ? { fromId: replyFromId } : {}),
          ...(quoteText && quoteText !== 'Message' ? { quoteText } : {}),
        };
      }
    }

    const mentions = this.extractMessageMentions(text, rawMsg.entities);
    const fwdFrom = this.extractForwardContext(rawMsg.fwdFrom);
    const media = this.extractMediaContext(rawMsg.media);

    return {
      id: `${peerId}:${rawMsg.id}`,
      peerId,
      date: rawMsg.date ?? Math.floor(Date.now() / 1000),
      message: text,
      out: Boolean(rawMsg.out),
      ...(fromId ? { fromId } : {}),
      ...(threadId ? { threadId } : {}),
      ...(replyTo ? { replyTo } : {}),
      ...(mentions.length > 0 ? { mentions } : {}),
      ...(fwdFrom ? { fwdFrom } : {}),
      ...(media ? { media } : {}),
    };
  }

  private extractMessageMentions(
    text: string,
    entities: TypeMessageEntity[] | undefined,
  ): AgentMessageMention[] {
    if (!entities || entities.length === 0 || !text) return [];
    const mentions: AgentMessageMention[] = [];

    for (const entity of entities) {
      if (
        entity.className !== 'MessageEntityMention' &&
        entity.className !== 'MessageEntityMentionName'
      ) {
        continue;
      }
      const surfaceText = text.slice(entity.offset, entity.offset + entity.length).trim();
      if (!surfaceText) continue;

      if (entity.className === 'MessageEntityMentionName') {
        const rawUid = 'userId' in entity ? entity.userId : undefined;
        let peerId: string | undefined;
        if (typeof rawUid === 'string' || typeof rawUid === 'number') {
          peerId = String(rawUid);
        } else if (rawUid && typeof rawUid === 'object' && 'userId' in rawUid) {
          peerId = String((rawUid as { userId: unknown }).userId);
        }
        const userEntity = peerId ? this.lookupPeerParticipant(peerId) : undefined;
        mentions.push({
          text: surfaceText,
          ...(peerId ? { peerId } : {}),
          ...(userEntity?.username ? { username: userEntity.username } : {}),
        });
      } else if (entity.className === 'MessageEntityMention') {
        const username = surfaceText.startsWith('@') ? surfaceText.slice(1) : surfaceText;
        const matchedPeer = this.findUserByUsername(username);
        mentions.push({
          text: surfaceText,
          username,
          ...(matchedPeer ? { peerId: matchedPeer.id } : {}),
        });
      }
    }

    return mentions;
  }

  private extractForwardContext(
    fwdFrom: TypeMessageFwdHeader | undefined,
  ): AgentMessageForwardContext | undefined {
    if (!fwdFrom) return undefined;
    const fromId = peerIdFromTypePeer(fwdFrom.fromId);
    const fromName = fwdFrom.fromName?.trim() || fwdFrom.postAuthor?.trim() || undefined;
    if (!fromId && !fromName) return undefined;
    return {
      ...(fromId ? { fromId } : {}),
      ...(fromName ? { fromName } : {}),
      ...(fwdFrom.date ? { date: fwdFrom.date } : {}),
    };
  }

  private extractMediaContext(
    media: TypeMessageMedia | undefined,
  ): AgentMessageMediaContext | undefined {
    if (!media || typeof media !== 'object') return undefined;

    if ('poll' in media && media.poll && typeof media.poll === 'object') {
      const poll = media.poll as { question?: { text?: string } | string };
      const questionText =
        typeof poll.question === 'string'
          ? poll.question
          : typeof poll.question?.text === 'string'
            ? poll.question.text
            : undefined;
      return {
        type: 'poll',
        ...(questionText ? { summary: `Poll: ${questionText}` } : {}),
      };
    }

    if ('phoneNumber' in media) {
      const contact = media as { firstName?: string; lastName?: string; phoneNumber?: string };
      const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
      const summary = [name, contact.phoneNumber].filter(Boolean).join(' ');
      return {
        type: 'contact',
        ...(summary ? { summary } : {}),
      };
    }

    if ('venueId' in media || 'geo' in media) {
      const venue = media as { title?: string; address?: string };
      const summary = [venue.title, venue.address].filter(Boolean).join(', ');
      return {
        type: 'location',
        ...(summary ? { summary } : {}),
      };
    }

    if ('document' in media && media.document && typeof media.document === 'object') {
      const doc = media.document as { attributes?: Array<Record<string, unknown>>; mimeType?: string };
      let fileName: string | undefined;
      for (const attr of doc.attributes ?? []) {
        if (attr && typeof attr.fileName === 'string' && attr.fileName) {
          fileName = attr.fileName;
          break;
        }
      }
      const isVoice = Boolean('voice' in media && media.voice);
      const isVideo = Boolean(('video' in media && media.video) || ('round' in media && media.round));
      return {
        type: isVoice ? 'voice' : isVideo ? 'video' : 'document',
        ...(fileName ? { fileName } : {}),
      };
    }

    if ('photo' in media && media.photo) {
      return { type: 'photo' };
    }

    return undefined;
  }

  /**
   * Build `DialogMemoryContext` for a batch of messages in `peerId`.
   * The `peers` map is scoped strictly to the peers referenced in `records`.
   */
  private buildDialogMemoryContext(
    peerId: string,
    records: AgentMessageRecord[],
  ): DialogMemoryContext {
    const peerType = dialogPeerKindFromId(peerId);
    const dialogPeer = this.lookupPeerParticipant(peerId);
    const referencedPeerIds = new Set<string>();

    const currentUser = this.globalStore?.auth.currentUser as
      | { id?: string; firstName?: string; lastName?: string; username?: string }
      | null
      | undefined;
    const currentUserId = currentUser?.id ? String(currentUser.id) : undefined;

    for (const rec of records) {
      if (rec.fromId) referencedPeerIds.add(rec.fromId);
      if (rec.out && currentUserId) referencedPeerIds.add(currentUserId);
      if (rec.replyTo?.fromId) referencedPeerIds.add(rec.replyTo.fromId);
      if (rec.fwdFrom?.fromId) referencedPeerIds.add(rec.fwdFrom.fromId);
      for (const mention of rec.mentions ?? []) {
        if (mention.peerId) {
          referencedPeerIds.add(mention.peerId);
        } else if (mention.username) {
          const byUsername = this.findUserByUsername(mention.username);
          if (byUsername) referencedPeerIds.add(byUsername.id);
        }
      }
    }

    // For 1:1 user dialogs, always include the dialog partner in the participant map
    if (peerType === 'user') {
      referencedPeerIds.add(peerId);
    }

    const peers: Record<string, DialogParticipantInfo> = {};
    for (const id of referencedPeerIds) {
      const info = this.lookupPeerParticipant(id);
      if (info) {
        peers[id] = info;
      } else if (currentUserId && id === currentUserId && currentUser) {
        const name = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ');
        peers[id] = {
          id,
          ...(name ? { name } : {}),
          ...(currentUser.username ? { username: currentUser.username } : {}),
          type: 'user',
          isSelf: true,
        };
      }
    }

    return {
      peerId,
      ...(dialogPeer?.name ? { peerName: dialogPeer.name } : {}),
      peerType,
      ...(Object.keys(peers).length > 0 ? { peers } : {}),
    };
  }

  private lookupPeerParticipant(peerId: string): DialogParticipantInfo | undefined {
    if (!this.storeManager) return undefined;
    const kind = dialogPeerKindFromId(peerId);
    const currentUser = this.globalStore?.auth.currentUser as { id?: string } | null | undefined;
    const isSelfId = Boolean(currentUser?.id && String(currentUser.id) === peerId);

    if (kind === 'user' && this.storeManager.has('user')) {
      const user = this.storeManager.get('user').get(peerId);
      if (user) {
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
        return {
          id: peerId,
          ...(name ? { name } : {}),
          ...(user.username ? { username: user.username } : {}),
          type: 'user',
          ...(user.self || isSelfId ? { isSelf: true } : {}),
        };
      }
    } else if (kind === 'channel' && this.storeManager.has('channel')) {
      const channel = this.storeManager.get('channel').get(peerId) ??
        this.storeManager.get('channel').get(peerId.replace(/^-100/, ''));
      if (channel) {
        return {
          id: peerId,
          ...(channel.title ? { name: channel.title } : {}),
          ...(channel.username ? { username: channel.username } : {}),
          type: 'channel',
        };
      }
    } else if (this.storeManager.has('chat')) {
      const chat = this.storeManager.get('chat').get(peerId) ??
        this.storeManager.get('chat').get(peerId.replace(/^-/, ''));
      if (chat) {
        return {
          id: peerId,
          ...(chat.title ? { name: chat.title } : {}),
          type: 'chat',
        };
      }
    }

    return undefined;
  }

  private findUserByUsername(username: string): DialogParticipantInfo | undefined {
    if (!this.storeManager || !this.storeManager.has('user')) return undefined;
    const target = username.replace(/^@/, '').trim().toLowerCase();
    if (!target) return undefined;

    const userStore = this.storeManager.get('user');
    for (const [, user] of userStore.getAllData()) {
      if (user?.username && user.username.toLowerCase() === target) {
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
        return {
          id: String(user.id),
          ...(name ? { name } : {}),
          username: user.username,
          type: 'user',
          ...(user.self ? { isSelf: true } : {}),
        };
      }
    }
    return undefined;
  }
}
