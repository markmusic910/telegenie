// Auto-generated types from api.d.ts namespace: chatlists
// Generated on 2025-09-13T14:20:50.992Z

import type {
  TypeChat,
  TypeDialogFilter,
  TypePeer,
  TypeTextWithEntities,
  TypeUser,
} from './api-types';

export type ChatlistInvite = {
  // flags: null // null;
  titleNoanimate?: boolean; // boolean;
  title: TypeTextWithEntities; // Api.TypeTextWithEntities -> TypeTextWithEntities;
  emoticon?: string; // string;
  peers: TypePeer[]; // Api.TypePeer[] -> TypePeer[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type ChatlistInviteAlready = {
  filterId: number; // int -> number;
  missingPeers: TypePeer[]; // Api.TypePeer[] -> TypePeer[];
  alreadyPeers: TypePeer[]; // Api.TypePeer[] -> TypePeer[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type ChatlistUpdates = {
  missingPeers: TypePeer[]; // Api.TypePeer[] -> TypePeer[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type ExportedChatlistInvite = {
  filter: TypeDialogFilter; // Api.TypeDialogFilter -> TypeDialogFilter;
  invite: TypeExportedChatlistInvite; // Api.TypeExportedChatlistInvite -> TypeExportedChatlistInvite;
};

export type ExportedInvites = {
  invites: TypeExportedChatlistInvite[]; // Api.TypeExportedChatlistInvite[] -> TypeExportedChatlistInvite[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type TypeChatlistInvite = ChatlistInviteAlready | ChatlistInvite; // chatlists.ChatlistInviteAlready | chatlists.ChatlistInvite

export type TypeChatlistUpdates = ChatlistUpdates; // chatlists.ChatlistUpdates

export type TypeExportedChatlistInvite = ExportedChatlistInvite; // chatlists.ExportedChatlistInvite

export type TypeExportedInvites = ExportedInvites; // chatlists.ExportedInvites
