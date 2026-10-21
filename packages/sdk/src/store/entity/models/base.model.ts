import { action, computed, makeObservable, observable, toJS } from 'mobx';
import type { EntityWithId } from '../../types';
import { stringifyJson } from '../../utils/json';

export function makeModelObservable(target: any) {
  const overrides: any = {};
  for (const key of Object.keys(target)) {
    if (typeof target[key] === 'function') {
      overrides[key] = action;
    } else {
      overrides[key] = observable;
    }
  }
  const proto = Object.getPrototypeOf(target);
  for (const name of Object.getOwnPropertyNames(proto)) {
    if (name === 'constructor') continue;
    const desc = Object.getOwnPropertyDescriptor(proto, name);
    if (desc) {
      if (desc.get) {
        overrides[name] = computed;
      } else if (typeof desc.value === 'function') {
        overrides[name] = action;
      }
    }
  }
  makeObservable(target, overrides);
}

export default class BaseEntityModel<T extends EntityWithId> {
  id = '';

  constructor(data: T) {
    this.id = data.id.toString();
  }

  toJSON(): string {
    return stringifyJson(toJS(this));
  }

  static fromJSON(_json: string): any {
    return {} as any;
  }
}
