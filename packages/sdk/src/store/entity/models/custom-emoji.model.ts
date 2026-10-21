import type { TypeDocumentAttribute, TypePhotoSize, TypeVideoSize } from '@telegenie/libs/foundation/telegram/types/file';
import type { CustomEmojiDocumentEntity } from '../../types';
import BaseEntityModel, { makeModelObservable } from './base.model';

/**
 * Custom-emoji document. A row with an empty `mimeType` is a placeholder
 * created by a lookup that has not hit IndexedDB or Telegram yet.
 */
export class CustomEmojiDocument extends BaseEntityModel<CustomEmojiDocumentEntity> {
  accessHash = '';
  fileReference = '';
  date = 0;
  mimeType = '';
  size = '0';
  dcId = 0;
  thumbs?: TypePhotoSize[];
  videoThumbs?: TypeVideoSize[];
  attributes: TypeDocumentAttribute[] = [];

  constructor(data: Partial<CustomEmojiDocumentEntity> & { id: string }) {
    super(data as CustomEmojiDocumentEntity);
    this.accessHash = data.accessHash ?? '';
    this.fileReference = data.fileReference ?? '';
    this.date = data.date ?? 0;
    this.mimeType = data.mimeType ?? '';
    this.size = data.size ?? '0';
    this.dcId = data.dcId ?? 0;
    this.thumbs = data.thumbs;
    this.videoThumbs = data.videoThumbs;
    this.attributes = data.attributes ?? [];
    makeModelObservable(this);
  }
}
