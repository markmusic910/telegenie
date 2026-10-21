import { DEFAULT_AVATAR_MIME, DUMMY_DOMAIN } from '../constants';

export type PeerAvatarUrlParams = {
  peerId: string;
  photoId: string;
  dcId: number;
  isBig?: boolean;
  mimeType?: string;
};

/** Build a same-origin SW `/avatar/` URL for a UserProfilePhoto / ChatPhoto stub. */
export function buildPeerAvatarUrl(params: PeerAvatarUrlParams): string {
  const search = new URLSearchParams({
    peerId: params.peerId,
    photoId: params.photoId,
    dcId: String(params.dcId),
    mimeType: params.mimeType ?? DEFAULT_AVATAR_MIME,
  });
  if (params.isBig) {
    search.set('big', '1');
  }
  return `/avatar/?${search.toString()}`;
}

/** Parse SW `/avatar/` query params into a download item. */
export function parsePeerAvatarUrl(url: string): PeerAvatarUrlParams | undefined {
  const parsed = new URL(url, DUMMY_DOMAIN);
  const peerId = parsed.searchParams.get('peerId');
  const photoId = parsed.searchParams.get('photoId');
  const dcIdParam = parsed.searchParams.get('dcId');
  if (!peerId || !photoId || !dcIdParam) {
    return undefined;
  }

  const dcId = Number(dcIdParam);
  if (!Number.isFinite(dcId)) {
    return undefined;
  }

  const mimeType = parsed.searchParams.get('mimeType') ?? DEFAULT_AVATAR_MIME;
  const big = parsed.searchParams.get('big');
  return {
    peerId,
    photoId,
    dcId,
    mimeType,
    isBig: big === '1' || big === 'true' || undefined,
  };
}
