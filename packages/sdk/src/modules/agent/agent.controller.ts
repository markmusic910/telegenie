import { Controller, Method, RequestLog, getTabId } from '@telegenie/decorators';
import { createLazyAgentWorkerClient, type AgentWorkerClient } from '@telegenie/agent/worker';
import { createDefaultAgentWorker } from '@telegenie/agent/worker/create-default-agent-worker';
import type { UpdateUiStatePayload } from '@telegenie/libs/types/tab-page.api';
import type { AgentMessageRecord } from '@telegenie/agent/worker';
import { TabPage } from './tab-page';

export type AgentControllerOptions = {
  createWorkerClient?: () => AgentWorkerClient;
  /** Per-tab identifier (e.g. from tab leader election or sessionStorage). */
  tabId?: string;
  getTabId?: () => string;
  /** Proxy Telegram auth check via the tab's SharedWorker client. */
  telegramIsAuthorized?: () => Promise<boolean>;
  /** Apply agent-driven UI updates on this tab. */
  updateUiState?: (payload: UpdateUiStatePayload) => void;
  /** Receive streaming LLM tokens from the agent worker. */
  onStreamToken?: (runId: string, token: string) => void;
  /** Returns true if this tab is currently the leader. Used to gate Memory Engine calls. */
  isLeader?: () => boolean;
};

/**
 * SDK façade for the per-tab agent DedicatedWorker + tab-page API host.
 */
@Controller
export class AgentController {
  private readonly worker: AgentWorkerClient;
  private readonly tabPage: TabPage;
  private readonly isLeader: () => boolean;

  private readonly streamTokenListeners = new Set<(runId: string, token: string) => void>();

  constructor(options: AgentControllerOptions = {}) {
    const tabId = options.tabId ?? options.getTabId?.() ?? getTabId();
    this.worker =
      options.createWorkerClient?.() ??
      createLazyAgentWorkerClient(() => createDefaultAgentWorker({ tabId }));

    this.isLeader = options.isLeader ?? (() => false);

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
   * Spawn the agent worker (if needed) and expose TabPageApi over an
   * `agent-page` MessageChannel so the worker can call back into this tab.
   */
  @RequestLog()
  @Method()
  async connectPageBridge(): Promise<void> {
    // Force lazy client to construct the DedicatedWorker, then transfer the page port.
    const agentWorker = this.worker.worker;
    this.tabPage.connect(agentWorker);
  }

  @RequestLog()
  @Method()
  disconnectPageBridge(): void {
    this.tabPage.disconnect();
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
   * Optionally pass peerId to include dialog presets and chat history.
   * The worker invokes the compiled LangGraph graph.
   */
  @RequestLog()
  @Method()
  chat(userMessage: string, peerId?: string): Promise<string> {
    return this.worker.call('chat', [userMessage, peerId]);
  }

  /**
   * Configure the LLM used by the agent worker.
   * Must be called once after connectPageBridge() and before chat().
   */
  @RequestLog()
  @Method()
  configureModel(apiKey: string, model: string): Promise<void> {
    return this.worker.call('configureModel', [apiKey, model]);
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

  /**
   * Forward new Telegram messages to the Memory Engine.
   * LEADER TAB ONLY — follower tabs must not call this.
   * The caller is responsible for checking isLeader() before invoking.
   */
  @RequestLog()
  @Method()
  async processNewMessages(messages: AgentMessageRecord[]): Promise<void> {
    if (!this.isLeader()) return;
    await this.worker.call('processNewMessages', [messages]);
  }

  /** @internal */
  @RequestLog()
  @Method()
  getWorkerClient(): AgentWorkerClient {
    return this.worker;
  }
}
