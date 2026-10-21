import { toJS } from 'mobx';
import type { DialogFilterEntity } from '../../types';
import { stringifyJson } from '../../utils/json';
import BaseEntityModel, { makeModelObservable } from './base.model';

/**
 * @see https://core.telegram.org/constructor/dialogFilter
 */
export class DialogFilterModel extends BaseEntityModel<DialogFilterEntity> {
  folderId: number;
  title: string;
  emoticon?: string;
  color?: number;
  isDefault: boolean;
  isLocal: boolean;
  isChatlist: boolean;
  contacts?: boolean;
  nonContacts?: boolean;
  groups?: boolean;
  broadcasts?: boolean;
  bots?: boolean;
  excludeMuted?: boolean;
  excludeRead?: boolean;
  excludeArchived?: boolean;
  pinnedPeerIds: string[];
  includePeerIds: string[];
  excludePeerIds: string[];

  constructor(data: DialogFilterEntity) {
    super(data);
    this.folderId = data.folderId ?? 0;
    this.title = data.title ?? '';
    this.emoticon = data.emoticon;
    this.color = data.color;
    this.isDefault = data.isDefault ?? false;
    this.isLocal = data.isLocal ?? false;
    this.isChatlist = data.isChatlist ?? false;
    this.contacts = data.contacts;
    this.nonContacts = data.nonContacts;
    this.groups = data.groups;
    this.broadcasts = data.broadcasts;
    this.bots = data.bots;
    this.excludeMuted = data.excludeMuted;
    this.excludeRead = data.excludeRead;
    this.excludeArchived = data.excludeArchived;
    this.pinnedPeerIds = data.pinnedPeerIds ?? [];
    this.includePeerIds = data.includePeerIds ?? [];
    this.excludePeerIds = data.excludePeerIds ?? [];
    makeModelObservable(this);
  }

  /** True when the folder selects chats by category rather than an explicit list. */
  get hasCategoryFlags(): boolean {
    return Boolean(
      this.contacts || this.nonContacts || this.groups || this.broadcasts || this.bots,
    );
  }

  toJSON(): string {
    return stringifyJson(toJS(this));
  }

  static fromJSON(json: string): DialogFilterModel {
    return new DialogFilterModel(JSON.parse(json) as DialogFilterEntity);
  }
}
