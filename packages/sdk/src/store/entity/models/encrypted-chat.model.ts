import { toJS } from 'mobx';
import type { EncryptedChatStatus } from '../../types/encrypted-chat';
import type { EncryptedChatEntity } from '../../types/encrypted-chat';
import { stringifyJson } from '../../utils/json';
import BaseEntityModel, { makeModelObservable } from './base.model';

export class EncryptedChat extends BaseEntityModel<EncryptedChatEntity> {
  status: EncryptedChatStatus;
  accessHash?: string;
  date?: number;
  adminId?: string;
  participantId?: string;
  gA?: Uint8Array;
  gAOrB?: Uint8Array;
  keyFingerprint?: string;
  historyDeleted?: boolean;

  constructor(data: EncryptedChatEntity) {
    super(data);
    this.status = data.status;
    this.accessHash = 'accessHash' in data ? data.accessHash : undefined;
    this.date = 'date' in data ? data.date : undefined;
    this.adminId = 'adminId' in data ? data.adminId : undefined;
    this.participantId = 'participantId' in data ? data.participantId : undefined;
    this.gA = 'gA' in data ? data.gA : undefined;
    this.gAOrB = 'gAOrB' in data ? data.gAOrB : undefined;
    this.keyFingerprint = 'keyFingerprint' in data ? data.keyFingerprint : undefined;
    this.historyDeleted = 'historyDeleted' in data ? data.historyDeleted : undefined;
    makeModelObservable(this);
  }

  toJSON(): string {
    return stringifyJson(toJS(this));
  }

  static fromJSON(json: string): EncryptedChat {
    return new EncryptedChat(JSON.parse(json) as EncryptedChatEntity);
  }
}
