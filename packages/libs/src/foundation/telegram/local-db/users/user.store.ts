import type { User, UserEmpty, UserFull } from '../../types/users';
import { STORE } from '../constants';
import type { LocalDbContext } from '../context';
import { getFullWithTtl } from '../context';
import type { UserFullRow, UserPeerRow } from '../types';
import { isUserEmpty, mergeUser } from './merge-user';

export class UserStore {
  constructor(private readonly ctx: LocalDbContext) {}

  async putUser(user: User | UserEmpty): Promise<void> {
    const entity = await this.writeUser(user);
    this.ctx.notify({ store: 'users', kind: 'put', entities: [entity] });
  }

  async putUsers(users: Array<User | UserEmpty>): Promise<void> {
    if (users.length === 0) return;
    const entities: Array<User | UserEmpty> = [];
    for (const user of users) {
      entities.push(await this.writeUser(user));
    }
    this.ctx.notify({ store: 'users', kind: 'put', entities });
  }

  async getUser(id: string): Promise<User | undefined> {
    const row = await this.ctx.idb.get<UserPeerRow>(STORE.users, id);
    if (!row) return undefined;
    if (isUserEmpty(row.entity)) return undefined;
    return row.entity;
  }

  async getUserRow(id: string): Promise<UserPeerRow | undefined> {
    return this.ctx.idb.get<UserPeerRow>(STORE.users, id);
  }

  async putUserFull(full: UserFull): Promise<void> {
    const row: UserFullRow = { id: full.id, entity: full, storedAt: Date.now() };
    void this.ctx.idb.putQueued(STORE.userFull, row);
    this.ctx.notify({ store: 'userFull', kind: 'put', entities: [full] });
  }

  async getUserFull(id: string): Promise<UserFull | undefined> {
    return getFullWithTtl(this.ctx, STORE.userFull, id);
  }

  async invalidateUserFull(id: string): Promise<void> {
    void this.ctx.idb.deleteQueued(STORE.userFull, id);
    this.ctx.notify({ store: 'userFull', kind: 'invalidate', ids: [id] });
  }

  private async writeUser(user: User | UserEmpty): Promise<User | UserEmpty> {
    const local = await this.ctx.idb.get<UserPeerRow>(STORE.users, user.id);
    const { row, invalidateFull } = mergeUser(user, local);
    void this.ctx.idb.putQueued(STORE.users, row);
    if (invalidateFull) {
      await this.invalidateUserFull(user.id);
    }
    return row.entity;
  }
}
