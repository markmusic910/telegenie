// Auto-generated types from api.d.ts namespace: phone
// Generated on 2025-09-13T14:20:50.991Z

import type {
  TypeChat,
  TypeGroupCallParticipant,
  TypeGroupCallStreamChannel,
  TypePeer,
  TypeUser,
} from './api-types';

export type ExportedGroupCallInvite = {
  link: string; // string;
};

export type GroupCall = {
  call: TypeGroupCall; // Api.TypeGroupCall -> TypeGroupCall;
  participants: TypeGroupCallParticipant[]; // Api.TypeGroupCallParticipant[] -> TypeGroupCallParticipant[];
  participantsNextOffset: string; // string;
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type GroupCallStreamChannels = {
  channels: TypeGroupCallStreamChannel[]; // Api.TypeGroupCallStreamChannel[] -> TypeGroupCallStreamChannel[];
};

export type GroupCallStreamRtmpUrl = {
  url: string; // string;
  key: string; // string;
};

export type GroupParticipants = {
  count: number; // int -> number;
  participants: TypeGroupCallParticipant[]; // Api.TypeGroupCallParticipant[] -> TypeGroupCallParticipant[];
  nextOffset: string; // string;
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
  version: number; // int -> number;
};

export type JoinAsPeers = {
  peers: TypePeer[]; // Api.TypePeer[] -> TypePeer[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type PhoneCall = {
  phoneCall: TypePhoneCall; // Api.TypePhoneCall -> TypePhoneCall;
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type TypeExportedGroupCallInvite = ExportedGroupCallInvite; // phone.ExportedGroupCallInvite

export type TypeGroupCall = GroupCall; // phone.GroupCall

export type TypeGroupCallStreamChannels = GroupCallStreamChannels; // phone.GroupCallStreamChannels

export type TypeGroupCallStreamRtmpUrl = GroupCallStreamRtmpUrl; // phone.GroupCallStreamRtmpUrl

export type TypeGroupParticipants = GroupParticipants; // phone.GroupParticipants

export type TypeJoinAsPeers = JoinAsPeers; // phone.JoinAsPeers

export type TypePhoneCall = PhoneCall; // phone.PhoneCall
