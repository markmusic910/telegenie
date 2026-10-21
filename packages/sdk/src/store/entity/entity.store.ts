import { difference } from 'lodash-es';
import {
  observable,
  onBecomeObserved,
  onBecomeUnobserved,
  runInAction,
  toJS,
  type ObservableMap,
} from 'mobx';
import type { IdType } from '@telegenie/libs/foundation/notification';
import type { DataProvider, Entity, EntityStoreSchema, EntityWithId } from '../types';

const DEFAULT_CACHE_COUNT = 1000;
const REFRESH_CACHE_TIME = 5000;

class EntityStore<M extends EntityWithId, E extends Entity> {
  private _data: ObservableMap<string, M>;

  private readonly _model: new (...args: any[]) => M;

  private readonly _shouldSkipUpdate: EntityStoreSchema<M, E>['shouldSkipUpdate'];

  private _dataProvider: DataProvider<E> | null = null;

  private readonly _cacheCount: number;

  private _onChange: EntityStoreSchema<M, E>['onChange'];

  /**
   * ids that are referred to somewhere, for reference count and cache clearing
   */
  private readonly _referredIds: Set<string> = new Set();

  /**
   * map of entity disposal functions for updating reference count
   */
  private readonly _entityDisposalMap: Map<string, () => void> = new Map();

  private _isInClearing = false;

  constructor(options: EntityStoreSchema<M, E>) {
    const {
      cacheCount = DEFAULT_CACHE_COUNT,
      shouldSkipUpdate,
      model,
      dataProvider,
      onChange,
    } = options;
    this._cacheCount = cacheCount;
    this._shouldSkipUpdate = shouldSkipUpdate;
    this._model = model;
    this._dataProvider = dataProvider;
    this._onChange = onChange;
    this._data = observable.map<string, M>();
  }

  setOnChange(onChange: EntityStoreSchema<M, E>['onChange']) {
    this._onChange = onChange;
  }

  /**
   * Upsert entities or models into the store.
   * Always keeps MobX model instances in the map (never plain objects).
   * `onChange` receives plain serializable entity snapshots for persist layers.
   */
  update(items: Array<E | M>) {
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }
    this.updateModel(items);
    const plain = items.map((item) => this.toPlainEntity(item));
    this._onChange?.({ type: 'put', entities: plain });
  }

  /** Bulk load without write-through (e.g. IDB recover). Always stores MobX models. */
  hydrate(items: Array<E | M>) {
    this.updateModel(items);
  }

  deleteByIds(ids: IdType[]) {
    if (!ids?.length) {
      return;
    }
    runInAction(() => {
      ids.forEach((id) => {
        this._data.delete(String(id));
      });
    });
    this._onChange?.({ type: 'delete', ids: ids.map(String) });
  }

  /** Drop every in-memory entity and emit a single delete change for persist. */
  clear() {
    const ids = Array.from(this._data.keys());
    this.deleteByIds(ids);
  }

  private updateModel(items: Array<E | M>) {
    if (!Array.isArray(items)) {
      return;
    }
    runInAction(() => {
      items.forEach((item) => {
        const id = item.id.toString();
        const exist = this._data.get(id);
        if (exist) {
          this._partialUpdate(item);
        } else {
          this._set(item);
        }
      });
    });
  }

  get(id: IdType) {
    const model = this._data.get(id);
    if (!model) {
      this._set({ id } as E);
      const ret = this._getByService(id);
      if (ret instanceof Promise) {
        ret
          .then((res) => {
            if (res) {
              runInAction(() => {
                this.updateModel(res);
              });
            }
          })
          .catch((_error) => {
            console.error('store update fail');
          });
      } else if (ret) {
        this.updateModel(ret);
      }
    }

    return this._data.get(id) as M;
  }

  getAllData() {
    return this._data;
  }

  toJS() {
    return toJS(this._data);
  }

  getSize() {
    return this._data.size;
  }

  private _getByService(id: IdType) {
    if (!this._dataProvider) {
      throw new Error('dataProvider is not set');
    }

    return this._dataProvider.getById(id);
  }

  private toModel(item: E | M): M {
    if (item instanceof this._model) {
      return item as M;
    }
    return new this._model(item as E);
  }

  private toPlainEntity(item: E | M): E {
    const id = item.id.toString();
    const stored = this._data.get(id);
    if (stored) {
      return toJS(stored) as unknown as E;
    }
    if (item instanceof this._model) {
      return toJS(item) as unknown as E;
    }
    return item as E;
  }

  private _partialUpdate(partial: E | M) {
    const model = this._data.get(partial.id.toString());
    if (!model) {
      return;
    }
    const source = this.toModel(partial);
    const plain = toJS(source) as Record<string, unknown>;
    Object.keys(plain).forEach((key) => {
      if (!key) {
        return;
      }
      const value = plain[key];
      const skip = this?._shouldSkipUpdate?.(key, value);
      if (!skip) {
        (model as any)[key] = value;
      }
    });
  }

  private _set(item: E | M) {
    runInAction(() => {
      const model = this.toModel(item);
      const id = model.id.toString();
      this._data.set(id, model);
      this._registerHook(id);
      this._flushCache();
    });
  }

  private _registerHook(id: string) {
    if (this._entityDisposalMap.has(id)) {
      this._entityDisposalMap.get(id)!();
      this._entityDisposalMap.delete(id);
    }
    const disposeBecomeObserved = onBecomeObserved(this._data, id, this.addRefId(id));
    const disposeBecomeUnobserved = onBecomeUnobserved(this._data, id, this.delRefId(id));
    this._entityDisposalMap.set(id, () => {
      disposeBecomeObserved();
      disposeBecomeUnobserved();
    });
  }

  private readonly addRefId = (id: string) => () => {
    this._referredIds.add(id);
  };

  private readonly delRefId = (id: string) => () => {
    this._referredIds.delete(id);
  };

  private _flushCache(refreshTime = REFRESH_CACHE_TIME) {
    if (this._isInClearing) {
      return;
    }

    if (this.getSize() < this._cacheCount) {
      return;
    }
    this._isInClearing = true;

    setTimeout(() => {
      runInAction(() => {
        const existKeys = Array.from(this._data.keys());
        const allUsedIds = Array.from(this._referredIds.keys());

        const diffKeys = difference(existKeys, allUsedIds);
        diffKeys.forEach((id) => {
          this._data.delete(id);
        });
        this._isInClearing = false;
      });
    }, refreshTime);
  }
}

export default EntityStore;
