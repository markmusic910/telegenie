export type FileIdKind = 'photo' | 'document';

export type FileId = {
  kind: FileIdKind;
  id: string;
};

export function encodeFileId(kind: FileIdKind, id: string | { toString(): string }): string {
  const prefix = kind === 'photo' ? 'p' : 'd';
  return `${prefix}:${id.toString()}`;
}

export function encodeStoredConstructor(storedConstructor: string, id: string | { toString(): string }): string {
  if (storedConstructor === 'fileIdPhoto') return encodeFileId('photo', id);
  return encodeFileId('document', id);
}

export function decodeFileId(fileId: string): FileId | undefined {
  if (fileId.startsWith('p:')) return { kind: 'photo', id: fileId.slice(2) };
  if (fileId.startsWith('d:')) return { kind: 'document', id: fileId.slice(2) };
  return undefined;
}

export function kindFromStoredConstructor(storedConstructor: string): FileIdKind {
  return storedConstructor === 'fileIdPhoto' ? 'photo' : 'document';
}
