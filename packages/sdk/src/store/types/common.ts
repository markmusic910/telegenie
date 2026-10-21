import type BigInt from 'big-integer';

export type EntityWithId = {
  id: string | BigInt.BigInteger | number;
};

export type PeerType = 'user' | 'channel' | 'group';

type ENTITY_MODEL = 'ENTITY_MODEL';
type GLOBAL_MODEL = 'GLOBAL_MODEL';

export const MODEL_TYPE: {
  ENTITY_MODEL: ENTITY_MODEL;
  GLOBAL_MODEL: GLOBAL_MODEL;
} = {
  ENTITY_MODEL: 'ENTITY_MODEL',
  GLOBAL_MODEL: 'GLOBAL_MODEL',
};

export type DataProvider<E> = {
  getById(id: string): E[] | Promise<E[] | null>;
};

export type Entity = EntityWithId & {
  [name: string]: any;
};

export type EntityStoreChange<E extends Entity = Entity> =
  | { type: 'put'; entities: E[] }
  | { type: 'delete'; ids: string[] };

export type EntityStoreSchema<M extends EntityWithId, E extends Entity> = {
  model: new (...args: any[]) => M;
  dataProvider: DataProvider<E>;
  type: typeof MODEL_TYPE.ENTITY_MODEL;
  shouldSkipUpdate?: (key: string, value: any) => boolean;
  cacheCount?: number;
  /** Optional write-through hook (e.g. SDK StoreCache). */
  onChange?: (change: EntityStoreChange<E>) => void;
};

export type GlobalStoreSchema = {
  type: typeof MODEL_TYPE.GLOBAL_MODEL;
};
