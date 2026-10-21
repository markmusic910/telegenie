export type MessageMediaUrlParams = {
  fileId: string;
  accessHash: string;
  dcId: number;
  mimeType?: string;
  fileSize?: number;
  thumbSize?: string;
  peerId?: string;
  messageId?: number;
};

export type ProgressiveMediaUrlParams = {
  fileId: string;
  accessHash: string;
  dcId: number;
  mimeType?: string;
  fileSize?: number;
  peerId?: string;
  messageId?: number;
};

export type DownloadMediaUrlParams = {
  fileId: string;
  accessHash: string;
  dcId: number;
  mimeType?: string;
  fileSize?: number;
  filename?: string;
  peerId?: string;
  messageId?: number;
};

/** Build a same-origin SW `/media/` URL for full photo or thumbnail download and cache. */
export function buildMediaUrl(params: MessageMediaUrlParams): string {
  const search = new URLSearchParams({
    fileId: params.fileId,
    accessHash: params.accessHash,
    dcId: String(params.dcId),
  });
  if (params.mimeType) {
    search.set('mimeType', params.mimeType);
  }
  if (params.fileSize != null && Number.isFinite(params.fileSize)) {
    search.set('fileSize', String(params.fileSize));
  }
  if (params.thumbSize) {
    search.set('thumbSize', params.thumbSize);
  }
  if (params.peerId) {
    search.set('peerId', params.peerId);
  }
  if (params.messageId != null && Number.isFinite(params.messageId)) {
    search.set('messageId', String(params.messageId));
  }
  return `/media/?${search.toString()}`;
}

/** Build a same-origin SW `/progressive/` URL for video/audio streaming range requests. */
export function buildProgressiveUrl(params: ProgressiveMediaUrlParams): string {
  const search = new URLSearchParams({
    fileId: params.fileId,
    accessHash: params.accessHash,
    dcId: String(params.dcId),
  });
  if (params.mimeType) {
    search.set('mimeType', params.mimeType);
  }
  if (params.fileSize != null && Number.isFinite(params.fileSize)) {
    search.set('fileSize', String(params.fileSize));
  }
  if (params.peerId) {
    search.set('peerId', params.peerId);
  }
  if (params.messageId != null && Number.isFinite(params.messageId)) {
    search.set('messageId', String(params.messageId));
  }
  return `/progressive/?${search.toString()}`;
}

/** Build a same-origin SW `/download/` URL for file downloads with Content-Disposition attachment. */
export function buildDownloadUrl(params: DownloadMediaUrlParams): string {
  const search = new URLSearchParams({
    fileId: params.fileId,
    accessHash: params.accessHash,
    dcId: String(params.dcId),
  });
  if (params.mimeType) {
    search.set('mimeType', params.mimeType);
  }
  if (params.fileSize != null && Number.isFinite(params.fileSize)) {
    search.set('fileSize', String(params.fileSize));
  }
  if (params.filename) {
    search.set('filename', encodeURIComponent(params.filename));
  }
  if (params.peerId) {
    search.set('peerId', params.peerId);
  }
  if (params.messageId != null && Number.isFinite(params.messageId)) {
    search.set('messageId', String(params.messageId));
  }
  return `/download/?${search.toString()}`;
}
