// Auto-generated types from api.d.ts namespace: upload
// Generated on 2025-09-13T14:20:50.990Z

export type CdnFile = {
  bytes: Uint8Array // bytes -> Uint8Array;
};

export type CdnFileReuploadNeeded = {
  requestToken: Uint8Array // bytes -> Uint8Array;
};

export type File = {
  type: storage.TypeFileType // storage.TypeFileType;
  mtime: number // int -> number;
  bytes: Uint8Array // bytes -> Uint8Array;
};

export type FileCdnRedirect = {
  dcId: number // int -> number;
  fileToken: Uint8Array // bytes -> Uint8Array;
  encryptionKey: Uint8Array // bytes -> Uint8Array;
  encryptionIv: Uint8Array // bytes -> Uint8Array;
  fileHashes: TypeFileHash[] // Api.TypeFileHash[] -> TypeFileHash[];
};

export type WebFile = {
  size: number // int -> number;
  mimeType: string // string;
  fileType: storage.TypeFileType // storage.TypeFileType;
  mtime: number // int -> number;
  bytes: Uint8Array // bytes -> Uint8Array;
};

export type TypeCdnFile = upload.CdnFileReuploadNeeded | upload.CdnFile; // upload.CdnFileReuploadNeeded | upload.CdnFile

export type TypeFile = upload.File | upload.FileCdnRedirect; // upload.File | upload.FileCdnRedirect

export type TypeWebFile = upload.WebFile; // upload.WebFile

