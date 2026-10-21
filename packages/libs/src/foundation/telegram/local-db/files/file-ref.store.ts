import { STORE } from '../constants';
import type { LocalDbContext } from '../context';
import type { FileRefRow, FileSourceRecord, FileSourceRow } from '../types';

export class FileRefStore {
  constructor(private readonly ctx: LocalDbContext) {}

  async putFileRef(row: Omit<FileRefRow, 'updatedAt'> & { updatedAt?: number }): Promise<void> {
    const next: FileRefRow = { ...row, updatedAt: row.updatedAt ?? Date.now() };
    void this.ctx.idb.putQueued(STORE.fileRefs, next);
  }

  async getFileRef(fileId: string): Promise<FileRefRow | undefined> {
    return this.ctx.idb.get<FileRefRow>(STORE.fileRefs, fileId);
  }

  async deleteFileRef(fileId: string): Promise<void> {
    void this.ctx.idb.deleteQueued(STORE.fileRefs, fileId);
  }

  async putFileSource(input: {
    fileId: string;
    source: FileSourceRecord;
  }): Promise<void> {
    const sourceKind = input.source.kind;
    const key = `${input.fileId}|${sourceKind}`;
    const row: FileSourceRow = {
      key,
      fileId: input.fileId,
      sourceKind,
      source: input.source,
      updatedAt: Date.now(),
    };
    void this.ctx.idb.putQueued(STORE.fileSources, row);
  }

  async getFileSources(fileId: string): Promise<FileSourceRow[]> {
    return this.ctx.idb.getAllByIndex<FileSourceRow>(STORE.fileSources, 'byFileId', fileId);
  }

  async deleteFileSources(fileId: string): Promise<void> {
    const rows = await this.getFileSources(fileId);
    for (const row of rows) {
      void this.ctx.idb.deleteQueued(STORE.fileSources, row.key);
    }
  }
}
