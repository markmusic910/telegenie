export type IdbKey = IDBValidKey;

export type IdbIndexSchema = {
  name: string;
  keyPath: string | string[];
  unique?: boolean;
  multiEntry?: boolean;
};

export type IdbStoreSchema = {
  name: string;
  keyPath?: string | string[];
  autoIncrement?: boolean;
  indexes?: IdbIndexSchema[];
};

export type IdbOpenOptions = {
  name: string;
  version: number;
  stores: IdbStoreSchema[];
  /** Optional; defaults to global `indexedDB`. */
  factory?: IDBFactory;
  /** Write-queue flush delay (ms). */
  flushDelayMs?: number;
  /** Max pending ops per flush transaction. */
  maxBatchSize?: number;
};

export type IdbPutEntry<T = unknown> = {
  value: T;
  key?: IdbKey;
};

export type IdbQueuedOpType = 'put' | 'delete';

export type IdbQueuedOp = {
  type: IdbQueuedOpType;
  store: string;
  key: IdbKey;
  value?: unknown;
};

export type IdbTransactionMode = IDBTransactionMode;