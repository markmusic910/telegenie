import { Api } from '@telegenie/teleproto';
import { buildInputEntity } from '../../helpers';
import type { LocalDb } from '../../local-db/local-db';

export type PeerIdAccessHash = {
  id: string;
  accessHash?: string;
};

/** Resolve marked user ids to GramJS InputUser using LocalDb access hashes. */
export async function resolveInputUsers(
  localDb: LocalDb | undefined,
  options: PeerIdAccessHash[],
): Promise<Api.InputUser[]> {
  const result: Api.InputUser[] = [];
  for (const { id, accessHash } of options) {
    let hash = accessHash;
    if (!hash) {
      const row = await localDb?.getUserRow(id);
      hash = row?.entity.accessHash;
    }
    if (!hash) {
      throw new Error(`Missing accessHash for user ${id}`);
    }
    result.push(buildInputEntity(id, hash) as Api.InputUser);
  }
  return result;
}
