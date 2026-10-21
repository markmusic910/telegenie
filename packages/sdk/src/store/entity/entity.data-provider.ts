import to from 'await-to-js';
import { debounce } from 'lodash-es';
import type { Entity } from '../types';

const DEFAULT_DEBOUNCE_TIME = 100;

export class EntityDataProvider<E extends Entity> {
  private pendingIds: string[] = [];
  private fetcher: (ids: string[]) => E[] | Promise<E[] | null>;
  private debounceFetch: (() => void) | null = null;

  constructor({
    fetcher,
    debounceTime = DEFAULT_DEBOUNCE_TIME,
  }: {
    fetcher: (ids: string[]) => E[] | Promise<E[] | null>;
    debounceTime?: number;
  }) {
    this.fetcher = fetcher;
    this.debounceFetch = debounce(() => {
      this._doFetch(this.pendingIds);
      this.pendingIds = [];
    }, debounceTime);
  }

  private async _doFetch(ids: string[]) {
    const _ids = Array.from(new Set([...ids]));
    const [err, response] = await to(this.fetcher(_ids) as Promise<E[] | null>);
    if (err || !response) {
      console.error(err, `[EntityDataProvider] fetch ids = ${ids} failed`);
      return;
    }
    return response;
  }

  getById(id: string, force: boolean = false) {
    if (force) {
      return this._doFetch([id]);
    }
    this.pendingIds.push(id);
    this.debounceFetch?.();
  }
}
