import { EventEmitter2, type ListenerFn } from 'eventemitter2';
import {
  EVENT_TYPES,
  type IdType,
  type NotificationDeleteStore,
  type NotificationEntities,
  type NotificationEntityIds,
  type NotificationUpdateStore,
} from './types';

const MAX_LISTENERS = 1000;
// TODO: context for sdk & store
// TODO: hooks for usdSDK and useStore
// TODO: UpdateManager in SDK

class NotificationCenter {
  private readonly _eventEmitter: EventEmitter2;

  private readonly _listenerMap: Map<ListenerFn, { eventSet: Set<string>; wrapperListener: any }> =
    new Map();

  constructor() {
    this._eventEmitter = new EventEmitter2({
      maxListeners: MAX_LISTENERS,
    });
  }

  emitUpdateStore<T>(key: string, entities: T) {
    const notificationBody: NotificationEntities<T> = {
      entities,
      // partials, 这个先暂时留着，有可能会有partials更新的需求
    };

    const notification: NotificationUpdateStore<T> = {
      type: key as any,
      body: notificationBody,
    };

    this.emit(key, notification);
  }

  onUpdateStore<T>(key: string, listener: (payload: NotificationUpdateStore<T>) => void) {
    this.on<(payload: NotificationUpdateStore<T>) => void>(
      key,
      (payload) => payload.type === EVENT_TYPES.UPDATE_STORE && listener(payload),
    );
  }

  emitDeleteStore(key: string, ids: IdType[]) {
    const notificationBody: NotificationEntityIds = {
      ids,
    };

    const notification: NotificationDeleteStore = {
      type: key as any,
      body: notificationBody,
    };

    this.emit(key, notification);
  }

  onDeleteStore(key: string, listener: (payload: NotificationDeleteStore) => void) {
    this.on<(payload: NotificationDeleteStore) => void>(
      key,
      (payload) => payload.type === EVENT_TYPES.DELETE_STORE && listener(payload),
    );
  }

  emit(event: string, ...values: any[]): boolean {
    return this._eventEmitter.emit(event, ...values);
  }

  on<T = undefined>(
    event: string,
    listener: T extends (...args: any[]) => void ? T : ListenerFn,
  ): this {
    this._eventEmitter.on(event, this._addListener(event, listener));
    return this;
  }

  once<T = undefined>(
    event: string,
    listener: T extends (...args: any[]) => void ? T : ListenerFn,
  ): this {
    this._eventEmitter.once(event, this._addListener(event, listener, true));
    return this;
  }

  off(event: string, listener: ListenerFn): this {
    const wrapperListener = this._removeListener(event, listener);
    if (wrapperListener) {
      this._eventEmitter.off(event, wrapperListener);
    }

    return this;
  }

  offAll(event: string) {
    this._listenerMap.clear();
    this._eventEmitter.removeAllListeners(event);
  }

  private _addListener(event: string | string[], listener: ListenerFn, once?: boolean) {
    let cachedListenerObj = this._listenerMap.get(listener);
    if (!cachedListenerObj) {
      const errorFunc = (_error: any) => {
        // TODO 日志上报 事件出错
        // console.log(_error, '-----errorfunc');
      };
      const wrapperListener = (...values: any[]) => {
        try {
          const res: any = listener(...values);
          if (res instanceof Promise) {
            res.catch(errorFunc);
          }
        } catch (error) {
          errorFunc(error);
        } finally {
          if (once) {
            this._removeListener(event, listener);
          }
        }
      };
      cachedListenerObj = { eventSet: new Set<string>(), wrapperListener };
      this._listenerMap.set(listener, cachedListenerObj);
    }

    if (Array.isArray(event)) {
      event.forEach((key) => {
        if (cachedListenerObj) {
          cachedListenerObj.eventSet.add(key);
        }
      });
    } else {
      cachedListenerObj.eventSet.add(event);
    }
    return cachedListenerObj.wrapperListener;
  }

  private _removeListener(event: string | string[], listener: ListenerFn) {
    const cachedListenerObj = this._listenerMap.get(listener);
    if (!cachedListenerObj) {
      return null;
    }

    this._deleteKey(event, cachedListenerObj.eventSet);

    if (cachedListenerObj.eventSet.size === 0) {
      this._listenerMap.delete(listener);
    }

    return cachedListenerObj.wrapperListener;
  }

  private _deleteKey(key: string | string[], keySet: Set<string>) {
    if (Array.isArray(key)) {
      key.forEach((item) => {
        keySet.delete(item);
      });
    } else {
      keySet.delete(key);
    }
  }
}

const notificationCenter = new NotificationCenter();

export { notificationCenter, NotificationCenter };
