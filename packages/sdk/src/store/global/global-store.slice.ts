import { _autoAction, computed, makeObservable, observable } from 'mobx';

/**
 * Base for global-store slices.
 *
 * Do not call `makeAutoObservable` in the constructor — subclass fields are
 * uninitialized until after `super()` returns, and MobX forbids
 * `makeAutoObservable` on subclasses. Call {@link observe} at the end of
 * each concrete constructor instead.
 */
export abstract class GlobalStoreSlice {
  abstract toJS(): Record<string, unknown>;
  abstract hydrateFromSnapshot(snapshot: Record<string, unknown> | undefined): void;

  /** Observe this instance. Pass `false` for fields that must stay untracked. */
  protected observe(overrides: Record<string, false> = {}) {
    const annotations: Record<string, unknown> = { ...overrides };
    for (const key of Object.keys(this)) {
      if (key in overrides) continue;
      annotations[key] =
        typeof (this as Record<string, unknown>)[key] === 'function' ? _autoAction : observable;
    }
    const proto = Object.getPrototypeOf(this);
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor' || name in overrides) continue;
      const desc = Object.getOwnPropertyDescriptor(proto, name);
      if (!desc) continue;
      if (desc.get) annotations[name] = computed;
      else if (typeof desc.value === 'function') annotations[name] = _autoAction;
    }
    makeObservable(this, annotations as never);
  }
}
