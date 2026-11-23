import { createMessageChannelPair } from '@telegenie/libs/foundation/telegram/worker/sw-bridge-protocol';
import {
  exposeWorkerApi,
  type ExposedWorkerApi,
  type RpcHandlers,
  type WorkerLike,
} from '@telegenie/libs/foundation/worker-rpc';
import type {
  TabPageApi,
  TabPageToolCallEvent,
  TabPageToolContext,
  TabPageToolResult,
  UpdateUiStatePayload,
} from '@telegenie/libs/types/tab-page.api';
import { AGENT_PAGE_BRIDGE_INIT } from '@telegenie/agent/worker';

export type { TabPageApi, UpdateUiStatePayload };

export type TabPageOptions = {
  /** Proxy Telegram auth check via the tab’s SharedWorker client. */
  telegramIsAuthorized: () => Promise<boolean>;
  /** Apply agent-driven UI updates on this tab. */
  updateUiState: (payload: UpdateUiStatePayload) => void;
  /** Receive a streaming LLM token from the agent worker. */
  onStreamToken?: (runId: string, token: string) => void;
  /** Execute a tab-registered tool invoked by the agent worker. */
  onInvokeTool?: (
    name: string,
    args: Record<string, unknown>,
    context: TabPageToolContext,
  ) => Promise<TabPageToolResult>;
  /** Receive a live tool-call lifecycle event from the agent worker. */
  onToolCallEvent?: (event: TabPageToolCallEvent) => void;
};

/**
 * Tab-page side of the agent `agent-page` bridge: hosts {@link TabPageApi} over
 * worker-rpc so the per-tab Agent DedicatedWorker can call back into the page
 * (UI updates, Telegram via the tab’s SharedWorker client, tab-registered tools, etc.).
 */
export class TabPage {
  private readonly telegramIsAuthorized: () => Promise<boolean>;
  private readonly updateUiState: (payload: UpdateUiStatePayload) => void;
  private readonly onStreamToken: ((runId: string, token: string) => void) | undefined;
  private readonly onInvokeTool:
    | ((
        name: string,
        args: Record<string, unknown>,
        context: TabPageToolContext,
      ) => Promise<TabPageToolResult>)
    | undefined;
  private readonly onToolCallEvent: ((event: TabPageToolCallEvent) => void) | undefined;
  private rpcHost: ExposedWorkerApi<Record<string, never>> | undefined;
  private bridgeCloser: (() => void) | undefined;

  constructor(options: TabPageOptions) {
    this.telegramIsAuthorized = options.telegramIsAuthorized;
    this.updateUiState = options.updateUiState;
    this.onStreamToken = options.onStreamToken;
    this.onInvokeTool = options.onInvokeTool;
    this.onToolCallEvent = options.onToolCallEvent;
  }

  /**
   * Transfer an agent↔page MessagePort and expose {@link TabPageApi} on this tab.
   */
  connect(agentWorker: WorkerLike): void {
    this.disconnect();

    const { port1, port2 } = createMessageChannelPair();

    this.rpcHost = exposeWorkerApi<TabPageApi>({
      handlers: this.createHandlers(),
      port: port1,
      tag: 'tab-page',
    });
    port1.start();

    agentWorker.postMessage(AGENT_PAGE_BRIDGE_INIT, [port2]);

    this.bridgeCloser = () => {
      this.rpcHost?.dispose();
      this.rpcHost = undefined;
      try {
        port1.close();
      } catch {
        // ignore
      }
      try {
        port2.close();
      } catch {
        // ignore
      }
    };
  }

  disconnect(): void {
    this.bridgeCloser?.();
    this.bridgeCloser = undefined;
  }

  private createHandlers(): RpcHandlers<TabPageApi> {
    return {
      ping: async (): Promise<'pong'> => 'pong',
      updateUiState: async (payload) => {
        this.updateUiState(payload);
      },
      telegramIsAuthorized: async () => this.telegramIsAuthorized(),
      streamToken: async (runId, token) => {
        this.onStreamToken?.(runId, token);
      },
      invokeTool: async (name, args, context): Promise<TabPageToolResult> => {
        if (!this.onInvokeTool) {
          return { ok: false, error: `No tool dispatcher configured on tab for "${name}".` };
        }
        return this.onInvokeTool(name, args, context);
      },
      toolCallEvent: async (event) => {
        this.onToolCallEvent?.(event);
      },
    };
  }
}
