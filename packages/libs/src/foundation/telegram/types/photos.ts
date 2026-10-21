// Auto-generated types from api.d.ts namespace: photos
// Generated on 2025-09-13T14:20:50.990Z
//
// Namespace results live here. TL constructor `photo` / TypePhoto live in ./file.

import type { TypePhoto } from './file';
import type { TypeUser } from './users';

/** photos.Photo — wrapper around a photo constructor + related users */
export type PhotosPhoto = {
  photo: TypePhoto;
  users: TypeUser[];
};

export type Photos = {
  photos: TypePhoto[];
  users: TypeUser[];
};

export type PhotosSlice = {
  count: number;
  photos: TypePhoto[];
  users: TypeUser[];
};

export type TypePhotosPhoto = PhotosPhoto;

export type TypePhotos = Photos | PhotosSlice;
