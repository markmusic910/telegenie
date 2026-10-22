import { BUILTIN_PRESETS } from './builtin-presets';
import type { AgentPreset } from './preset.types';

// TODO: support persist into idb
export class PresetService {
  private customPresets = new Map<string, AgentPreset>();

  getAllPresets(): AgentPreset[] {
    const customList = Array.from(this.customPresets.values());
    // Builtin presets first, followed by custom ones
    return [...BUILTIN_PRESETS, ...customList];
  }

  getPresetById(id: string): AgentPreset | undefined {
    return this.customPresets.get(id) ?? BUILTIN_PRESETS.find((p) => p.id === id);
  }

  registerPreset(preset: AgentPreset): void {
    this.customPresets.set(preset.id, {
      ...preset,
      isBuiltin: false,
      updatedAt: Date.now(),
      createdAt: preset.createdAt ?? Date.now(),
    });
  }

  deletePreset(id: string): boolean {
    // Built-in presets cannot be deleted
    if (BUILTIN_PRESETS.some((p) => p.id === id)) {
      return false;
    }
    return this.customPresets.delete(id);
  }
}

/** Global singleton instance for worker runtime. */
export const presetService = new PresetService();
