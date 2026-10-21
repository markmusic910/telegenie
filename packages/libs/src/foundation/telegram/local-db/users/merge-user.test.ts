import type { User, UserEmpty } from '../../types/users';
import type { UserPeerRow } from '../types';
import { isUserEmpty, mergeUser } from './merge-user';

function user(partial: Partial<User> & { id: string }): User {
  return {
    min: false,
    ...partial,
  } as User;
}

function row(entity: User, overrides: Partial<UserPeerRow> = {}): UserPeerRow {
  return {
    id: entity.id,
    entity,
    minAccessHash: false,
    updatedAt: 1,
    ...overrides,
  };
}

describe('isUserEmpty', () => {
  it('detects UserEmpty', () => {
    expect(isUserEmpty({ id: '1' } as UserEmpty)).toBe(true);
  });

  it('rejects User with fields', () => {
    expect(isUserEmpty(user({ id: '1', accessHash: 'a' }))).toBe(false);
  });
});

describe('mergeUser', () => {
  it('stores non-min user with minAccessHash false', () => {
    const { row: next } = mergeUser(
      user({ id: '1', accessHash: 'ah', firstName: 'A', contact: true }),
    );
    expect(next.minAccessHash).toBe(false);
    expect(next.entity.firstName).toBe('A');
    expect(next.entity.contact).toBe(true);
  });

  it('creates stub from empty without local', () => {
    const { row: next, invalidateFull } = mergeUser({ id: '9' } as UserEmpty, undefined, 11);
    expect(invalidateFull).toBe(false);
    expect(next.entity).toEqual({ id: '9' });
    expect(next.updatedAt).toBe(11);
  });

  it('keeps local on empty when local exists', () => {
    const local = row(user({ id: '1', accessHash: 'a', firstName: 'Keep' }));
    const { row: next } = mergeUser({ id: '1' } as UserEmpty, local, 12);
    expect(next.entity.firstName).toBe('Keep');
    expect(next.updatedAt).toBe(12);
  });

  it('treats sparse local as insert', () => {
    const local = row({ id: '1' } as User);
    const { row: next } = mergeUser(user({ id: '1', accessHash: 'ah', firstName: 'A' }), local);
    expect(next.entity.firstName).toBe('A');
    expect(next.entity.accessHash).toBe('ah');
  });

  it('preserves full access hash when min user arrives', () => {
    const local = row(user({ id: '1', accessHash: 'full', firstName: 'A', contact: true, min: false }));
    const { row: next } = mergeUser(
      user({
        id: '1',
        accessHash: 'minHash',
        min: true,
        phone: '1',
        firstName: 'B',
        contact: false,
      }),
      local,
    );
    expect(next.entity.accessHash).toBe('full');
    expect(next.minAccessHash).toBe(false);
    expect(next.entity.contact).toBe(true);
    expect(next.entity.min).toBe(false);
  });

  it('does not overwrite contact from min when local is non-min', () => {
    const local = row(user({ id: '1', accessHash: 'full', contact: true, min: false }));
    const { row: next } = mergeUser(
      user({ id: '1', min: true, contact: false, accessHash: 'x', phone: '1' }),
      local,
    );
    expect(next.entity.contact).toBe(true);
  });

  it('applies identity fields from min when local was also min', () => {
    const local = row(
      user({ id: '1', accessHash: 'm1', min: true, firstName: 'Old' }),
      { minAccessHash: true },
    );
    const { row: next } = mergeUser(
      user({
        id: '1',
        accessHash: 'm2',
        min: true,
        phone: undefined,
        firstName: 'New',
        lastName: 'L',
        premium: true,
      }),
      local,
    );
    expect(next.entity.min).toBe(true);
    expect(next.entity.firstName).toBe('New');
    expect(next.entity.lastName).toBe('L');
    expect(next.entity.premium).toBe(true);
  });

  it('skips identity from min when local is non-min', () => {
    const local = row(user({ id: '1', accessHash: 'full', firstName: 'Keep', min: false }));
    const { row: next } = mergeUser(
      user({ id: '1', accessHash: 'm', min: true, phone: '1', firstName: 'Skip' }),
      local,
    );
    expect(next.entity.firstName).toBe('Keep');
  });

  it('applies photo from min when applyMinPhoto is set', () => {
    const photo = { hasVideo: false } as User['photo'];
    const local = row(user({ id: '1', accessHash: 'full', min: false }));
    const { row: next } = mergeUser(
      user({
        id: '1',
        accessHash: 'm',
        min: true,
        phone: '1',
        applyMinPhoto: true,
        photo,
      }),
      local,
    );
    expect(next.entity.photo).toBe(photo);
  });

  it('skips photo from min when local is non-min and applyMinPhoto unset', () => {
    const localPhoto = { hasVideo: true } as User['photo'];
    const local = row(user({ id: '1', accessHash: 'full', min: false, photo: localPhoto }));
    const { row: next } = mergeUser(
      user({
        id: '1',
        accessHash: 'm',
        min: true,
        phone: '1',
        photo: { hasVideo: false } as User['photo'],
      }),
      local,
    );
    expect(next.entity.photo).toBe(localPhoto);
  });

  it('applies status from min when local status is empty', () => {
    const status = { wasOnline: 1 } as User['status'];
    const local = row(user({ id: '1', accessHash: 'full', min: false, status: {} as User['status'] }));
    const { row: next } = mergeUser(
      user({ id: '1', accessHash: 'm', min: true, phone: '1', status }),
      local,
    );
    expect(next.entity.status).toBe(status);
  });

  it('keeps non-empty status when min arrives over non-min local', () => {
    const localStatus = { wasOnline: 9 } as User['status'];
    const local = row(user({ id: '1', accessHash: 'full', min: false, status: localStatus }));
    const { row: next } = mergeUser(
      user({
        id: '1',
        accessHash: 'm',
        min: true,
        phone: '1',
        status: { wasOnline: 1 } as User['status'],
      }),
      local,
    );
    expect(next.entity.status).toBe(localStatus);
  });

  it('deletes field when min assigns undefined', () => {
    const local = row(
      user({ id: '1', accessHash: 'm1', min: true, firstName: 'A' }),
      { minAccessHash: true },
    );
    const incoming = user({ id: '1', accessHash: 'm2', min: true, phone: undefined });
    Object.assign(incoming, { firstName: undefined });
    const { row: next } = mergeUser(incoming, local);
    expect(next.entity.firstName).toBeUndefined();
  });

  it('invalidates full when bot flag changes on non-min', () => {
    const local = row(user({ id: '1', accessHash: 'a', bot: false }));
    const { invalidateFull } = mergeUser(user({ id: '1', accessHash: 'a', bot: true }), local);
    expect(invalidateFull).toBe(true);
  });

  it('invalidates full on username change only when botCanEdit is set', () => {
    const local = row(user({ id: '1', accessHash: 'a', username: 'old', botCanEdit: true }));
    const { invalidateFull } = mergeUser(
      user({ id: '1', accessHash: 'a', username: 'new', botCanEdit: true }),
      local,
    );
    expect(invalidateFull).toBe(true);
  });

  it('does not invalidate full on username change without botCanEdit', () => {
    const local = row(user({ id: '1', accessHash: 'a', username: 'old' }));
    const { invalidateFull } = mergeUser(
      user({ id: '1', accessHash: 'a', username: 'new' }),
      local,
    );
    expect(invalidateFull).toBe(false);
  });

  it('does not invalidate when non-min fields are unchanged', () => {
    const local = row(user({ id: '1', accessHash: 'a', bot: false, firstName: 'A' }));
    const { invalidateFull } = mergeUser(
      user({ id: '1', accessHash: 'a', bot: false, firstName: 'B' }),
      local,
    );
    expect(invalidateFull).toBe(false);
  });
});
