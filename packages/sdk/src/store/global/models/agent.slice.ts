import { DEFAULT_MODEL_ID } from '@telegenie/config';
import { GlobalStoreSlice } from '../global-store.slice';
import type { AgentSnapshot, AgentState } from './agent.state';

export class AgentSlice extends GlobalStoreSlice implements AgentState {
  selectedModel: string = DEFAULT_MODEL_ID;

  constructor() {
    super();
    this.observe();
  }

  setSelectedModel = (model: string) => {
    if (typeof model === 'string' && model.trim().length > 0) {
      this.selectedModel = model.trim();
    }
  };

  hydrateFromSnapshot = (snapshot: Record<string, unknown> | undefined) => {
    const raw = snapshot?.agent;
    if (!raw || typeof raw !== 'object') return;
    const source = raw as Record<string, unknown>;
    if (typeof source.selectedModel === 'string' && source.selectedModel.trim().length > 0) {
      this.selectedModel = source.selectedModel.trim();
    }
  };

  toSnapshot(): AgentSnapshot {
    return {
      agent: {
        selectedModel: this.selectedModel,
      },
    };
  }

  toJS(): Record<string, unknown> {
    return this.toSnapshot();
  }
}
