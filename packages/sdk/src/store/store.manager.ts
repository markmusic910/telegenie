import EntityStore from './entity/entity.store';
import GlobalStore from './global/global.store';

import {
  MODEL_TYPE,
  type AllStore,
  type AllStoreSchema,
  type EntityStoreSchema,
  type StoreMap,
  type StoreName,
} from './types';

class StoreManager {
  private readonly _schema: Record<string, AllStoreSchema> = {};

  private readonly _stores: {
    [name: string]: AllStore;
  } = {} as any;

  constructor() {}

  set<N extends StoreName>(name: N, store: StoreMap[N]): void;
  set(name: string, store: AllStore): void;
  set(name: string, store: AllStore) {
    this._stores[name] = store;
  }

  has(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this._stores, name);
  }

  remove(name: string) {
    delete this._stores[name];
  }

  get<N extends StoreName>(name: N): StoreMap[N];
  get(name: string): AllStore;
  get(name: string) {
    let store = this._stores[name];

    if (!store) {
      const options = this._schema[name];
      switch (options.type) {
        case MODEL_TYPE.ENTITY_MODEL:
          store = new EntityStore<any, any>(options as EntityStoreSchema<any, any>);
          break;
        default:
          store = new GlobalStore(this);
          break;
      }

      this.set(name, store);
    }

    return store;
  }

  names(): string[] {
    return Object.keys(this._stores);
  }

  toJS() {
    const data: any = {};
    Object.keys(this._stores).forEach((key) => {
      const model = (this._stores as any)[key];
      if (model.toJS) {
        data[key] = (this._stores as any)[key].toJS();
      }
    });
    return data;
  }
}

export default StoreManager;
