// Auto-generated types from api.d.ts namespace: contacts
// Generated on 2025-09-13T14:20:50.989Z

export type Blocked = {
  blocked: TypePeerBlocked[] // Api.TypePeerBlocked[] -> TypePeerBlocked[];
  chats: TypeChat[] // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type BlockedSlice = {
  count: number // int -> number;
  blocked: TypePeerBlocked[] // Api.TypePeerBlocked[] -> TypePeerBlocked[];
  chats: TypeChat[] // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type ContactBirthdays = {
  contacts: TypeContactBirthday[] // Api.TypeContactBirthday[] -> TypeContactBirthday[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type Contacts = {
  contacts: TypeContact[] // Api.TypeContact[] -> TypeContact[];
  savedCount: number // int -> number;
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type Found = {
  myResults: TypePeer[] // Api.TypePeer[] -> TypePeer[];
  results: TypePeer[] // Api.TypePeer[] -> TypePeer[];
  chats: TypeChat[] // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type ImportedContacts = {
  imported: TypeImportedContact[] // Api.TypeImportedContact[] -> TypeImportedContact[];
  popularInvites: TypePopularContact[] // Api.TypePopularContact[] -> TypePopularContact[];
  retryContacts: string[] // long[] -> string[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type ResolvedPeer = {
  peer: TypePeer // Api.TypePeer -> TypePeer;
  chats: TypeChat[] // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type TopPeers = {
  categories: TypeTopPeerCategoryPeers[] // Api.TypeTopPeerCategoryPeers[] -> TypeTopPeerCategoryPeers[];
  chats: TypeChat[] // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type TypeBlocked = contacts.Blocked | contacts.BlockedSlice; // contacts.Blocked | contacts.BlockedSlice

export type TypeContactBirthdays = contacts.ContactBirthdays; // contacts.ContactBirthdays

export type TypeContacts = contacts.ContactsNotModified | contacts.Contacts; // contacts.ContactsNotModified | contacts.Contacts

export type TypeFound = contacts.Found; // contacts.Found

export type TypeImportedContacts = contacts.ImportedContacts; // contacts.ImportedContacts

export type TypeResolvedPeer = contacts.ResolvedPeer; // contacts.ResolvedPeer

export type TypeTopPeers = contacts.TopPeersNotModified | contacts.TopPeers | contacts.TopPeersDisabled; // contacts.TopPeersNotModified | contacts.TopPeers | contacts.TopPeersDisabled

