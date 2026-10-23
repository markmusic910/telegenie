import { Client } from 'langsmith';
import { LangChainTracer } from '@langchain/core/tracers/tracer_langchain';
import type { Callbacks } from '@langchain/core/callbacks/manager';

export interface LangSmithConfig {
  tracing: boolean;
  endpoint: string;
  apiKey?: string;
  agentId?: string;
  agentEnvironment?: string;
  project?: string;
}

import {
  DEFAULT_LANGSMITH_ENDPOINT,
  isValidLangSmithApiKey,
} from '@telegenie/config';

/**
 * Retrieve LangSmith configuration from environment variables.
 * Checks build-injected `process.env` (Next.js / Webpack / Turbopack)
 * as well as runtime `globalThis.process.env`.
 */
export function getLangSmithEnvConfig(): LangSmithConfig {
  const getVar = (name: string): string | undefined => {
    try {
      // 1. Static process.env lookup (replaced by bundlers)
      if (name === 'NEXT_PUBLIC_LANGSMITH_TRACING') {
        const val = process.env.NEXT_PUBLIC_LANGSMITH_TRACING;
        if (val) return val;
      }
      if (name === 'NEXT_PUBLIC_LANGSMITH_ENDPOINT') {
        const val = process.env.NEXT_PUBLIC_LANGSMITH_ENDPOINT;
        if (val) return val;
      }
      if (name === 'NEXT_PUBLIC_LANGSMITH_API_KEY') {
        const val = process.env.NEXT_PUBLIC_LANGSMITH_API_KEY;
        if (val) return val;
      }
      if (name === 'NEXT_PUBLIC_LANGSMITH_AGENT_ID') {
        const val = process.env.NEXT_PUBLIC_LANGSMITH_AGENT_ID;
        if (val) return val;
      }
      if (name === 'NEXT_PUBLIC_LANGSMITH_AGENT_ENVIRONMENT') {
        const val = process.env.NEXT_PUBLIC_LANGSMITH_AGENT_ENVIRONMENT;
        if (val) return val;
      }
      if (name === 'NEXT_PUBLIC_LANGSMITH_PROJECT') {
        const val = process.env.NEXT_PUBLIC_LANGSMITH_PROJECT;
        if (val) return val;
      }

      // 2. Dynamic globalThis.process.env lookup (runtime in Web Workers)
      if (
        typeof globalThis !== 'undefined' &&
        (globalThis as unknown as { process?: { env?: Record<string, string> } }).process?.env
      ) {
        return (globalThis as unknown as { process: { env: Record<string, string> } }).process.env[name];
      }
      return undefined;
    } catch {
      return undefined;
    }
  };

  const tracingRaw = getVar('NEXT_PUBLIC_LANGSMITH_TRACING');
  const tracing = tracingRaw === 'true' || tracingRaw === '1';
  const endpoint = getVar('NEXT_PUBLIC_LANGSMITH_ENDPOINT') || DEFAULT_LANGSMITH_ENDPOINT;
  const apiKey = getVar('NEXT_PUBLIC_LANGSMITH_API_KEY');
  const agentId = getVar('NEXT_PUBLIC_LANGSMITH_AGENT_ID') || 'telegenie';
  const agentEnvironment = getVar('NEXT_PUBLIC_LANGSMITH_AGENT_ENVIRONMENT') || 'local';
  const project = getVar('NEXT_PUBLIC_LANGSMITH_PROJECT') || agentId;

  return {
    tracing,
    endpoint,
    apiKey,
    agentId,
    agentEnvironment,
    project,
  };
}

let _activeClient: Client | undefined;
let _activeTracer: LangChainTracer | undefined;
let _currentConfig: LangSmithConfig | undefined;

/**
 * Ensure `globalThis.process.env` exists in the Web Worker context so LangChain's
 * internal `getEnvironmentVariable()` calls can read LangSmith settings dynamically.
 */
function polyfillWorkerProcessEnv(config: LangSmithConfig): void {
  const g = globalThis as unknown as { process?: { env?: Record<string, string> } };
  const env: Record<string, string> = g.process?.env ?? {};
  if (!g.process) {
    g.process = { env };
  } else {
    g.process.env = env;
  }
  if (config.tracing) {
    env.LANGSMITH_TRACING = 'true';
    env.LANGCHAIN_TRACING_V2 = 'true';
  } else {
    env.LANGSMITH_TRACING = 'false';
    env.LANGCHAIN_TRACING_V2 = 'false';
  }

  if (config.endpoint) {
    env.LANGSMITH_ENDPOINT = config.endpoint;
    env.LANGCHAIN_ENDPOINT = config.endpoint;
  }
  if (config.apiKey) {
    env.LANGSMITH_API_KEY = config.apiKey;
    env.LANGCHAIN_API_KEY = config.apiKey;
  }
  if (config.agentId) {
    env.LANGSMITH_AGENT_ID = config.agentId;
  }
  if (config.agentEnvironment) {
    env.LANGSMITH_AGENT_ENVIRONMENT = config.agentEnvironment;
  }
  if (config.project) {
    env.LANGSMITH_PROJECT = config.project;
    env.LANGCHAIN_PROJECT = config.project;
  }
}

/**
 * Initialize or reconfigure LangSmith monitoring.
 *
 * Sets up the LangSmith Client with Agent ID and Environment headers,
 * constructs a configured `LangChainTracer`, and polyfills `process.env` in the worker.
 */
export function initLangSmithMonitoring(
  customConfig?: Partial<LangSmithConfig>,
): LangChainTracer | undefined {
  const envConfig = getLangSmithEnvConfig();
  const config: LangSmithConfig = {
    ...envConfig,
    ...(customConfig || {}),
  };

  _currentConfig = config;
  polyfillWorkerProcessEnv(config);

  if (!config.tracing) {
    _activeClient = undefined;
    _activeTracer = undefined;
    return undefined;
  }

  // When targeting LangSmith cloud directly (smith.langchain.com), a valid API key is required.
  // When targeting a proxy endpoint (e.g. www.telegenie.top/api/monitoring), the proxy
  // attaches the server-side API key so a client-side API key is optional.
  const isDirectLangSmith = config.endpoint.includes('smith.langchain.com');
  if (isDirectLangSmith && !isValidLangSmithApiKey(config.apiKey)) {
    _activeClient = undefined;
    _activeTracer = undefined;
    return undefined;
  }

  try {
    const headers: Record<string, string> = {};
    if (config.agentId) {
      headers['Langsmith-Agent-Id'] = config.agentId;
    }
    if (config.agentEnvironment) {
      headers['Langsmith-Agent-Environment'] = config.agentEnvironment;
    }

    _activeClient = new Client({
      apiUrl: config.endpoint,
      apiKey: config.apiKey || 'anonymous',
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });

    _activeTracer = new LangChainTracer({
      client: _activeClient,
      projectName: config.project,
      metadata: {
        agent_id: config.agentId,
        environment: config.agentEnvironment,
      },
      tags: [
        config.agentId ? `agent:${config.agentId}` : '',
        config.agentEnvironment ? `env:${config.agentEnvironment}` : '',
      ].filter(Boolean),
    });

    return _activeTracer;
  } catch (err) {
    console.warn('[LangSmith] Failed to initialize client or tracer:', err);
    _activeClient = undefined;
    _activeTracer = undefined;
    return undefined;
  }
}

/** Get the currently active LangChainTracer (if configured and valid). */
export function getLangSmithTracer(): LangChainTracer | undefined {
  if (!_activeTracer && !_currentConfig) {
    return initLangSmithMonitoring();
  }
  return _activeTracer;
}

/** Returns `[tracer]` callbacks array or undefined if tracing is not active. */
export function getLangSmithCallbacks(): Callbacks | undefined {
  const tracer = getLangSmithTracer();
  return tracer ? [tracer] : undefined;
}

/** Check if LangSmith monitoring is active. */
export function isLangSmithActive(): boolean {
  if (!_currentConfig?.tracing) return false;
  const isDirect = _currentConfig.endpoint.includes('smith.langchain.com');
  if (isDirect) {
    return isValidLangSmithApiKey(_currentConfig.apiKey);
  }
  return Boolean(_activeTracer || _currentConfig.tracing);
}

/** Get current effective LangSmith config. */
export function getLangSmithConfig(): LangSmithConfig {
  return _currentConfig ?? getLangSmithEnvConfig();
}
