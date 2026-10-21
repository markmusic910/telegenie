import { AGENT_STORE } from '../agent-db.constants';
import type { DialogPreset } from '../agent-db.types';
import type { AgentDb } from '../agent-db';

export class DialogPresetRepository {
  constructor(private readonly db: AgentDb) {}

  async findByPeerId(peerId: string): Promise<DialogPreset | undefined> {
    return this.db.get<DialogPreset>(AGENT_STORE.dialogPresets, peerId);
  }

  async findAll(): Promise<DialogPreset[]> {
    return this.db.getAll<DialogPreset>(AGENT_STORE.dialogPresets);
  }

  async upsert(
    preset: Omit<DialogPreset, 'createdAt' | 'updatedAt'> & {
      createdAt?: number;
      updatedAt?: number;
    },
  ): Promise<DialogPreset> {
    const now = Date.now();
    const existing = await this.findByPeerId(preset.peerId);
    const updated: DialogPreset = {
      ...preset,
      createdAt: existing?.createdAt ?? preset.createdAt ?? now,
      updatedAt: now,
    };
    await this.db.put<DialogPreset>(AGENT_STORE.dialogPresets, updated);
    return updated;
  }

  async delete(peerId: string): Promise<void> {
    await this.db.delete(AGENT_STORE.dialogPresets, peerId);
  }
}
