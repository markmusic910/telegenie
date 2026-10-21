 
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import type {
  TypeAutoSaveException,
  TypeBusinessChatLink,
  TypeChat,
  TypeConnectedBot,
  TypeDocument,
  TypeEmojiStatus,
  TypeMessageEntity,
  TypePasswordKdfAlgo,
  TypePeer,
  TypePrivacyRule,
  TypeSecurePasswordKdfAlgo,
  TypeSecureRequiredType,
  TypeSecureSecretSettings,
  TypeSecureValue,
  TypeSecureValueError,
  TypeTheme,
  TypeUser,
  TypeWallPaper,
  TypeWebAuthorization,
} from './api-types';
import type { TypeAuthorization, TypeSentCode } from './auth';

export type AuthorizationForm = {
  // flags: null // null;
  requiredTypes: TypeSecureRequiredType[]; // Api.TypeSecureRequiredType[] -> TypeSecureRequiredType[];
  values: TypeSecureValue[]; // Api.TypeSecureValue[] -> TypeSecureValue[];
  errors: TypeSecureValueError[]; // Api.TypeSecureValueError[] -> TypeSecureValueError[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
  privacyPolicyUrl?: string; // string;
};

export type Authorizations = {
  authorizationTtlDays: number; // int -> number;
  authorizations: TypeAuthorization[]; // Api.TypeAuthorization[] -> TypeAuthorization[];
};

export type AutoDownloadSettings = {
  low: TypeAutoDownloadSettings; // Api.TypeAutoDownloadSettings -> TypeAutoDownloadSettings;
  medium: TypeAutoDownloadSettings; // Api.TypeAutoDownloadSettings -> TypeAutoDownloadSettings;
  high: TypeAutoDownloadSettings; // Api.TypeAutoDownloadSettings -> TypeAutoDownloadSettings;
};

export type AutoSaveSettings = {
  usersSettings: TypeAutoSaveSettings; // Api.TypeAutoSaveSettings -> TypeAutoSaveSettings;
  chatsSettings: TypeAutoSaveSettings; // Api.TypeAutoSaveSettings -> TypeAutoSaveSettings;
  broadcastsSettings: TypeAutoSaveSettings; // Api.TypeAutoSaveSettings -> TypeAutoSaveSettings;
  exceptions: TypeAutoSaveException[]; // Api.TypeAutoSaveException[] -> TypeAutoSaveException[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type BusinessChatLinks = {
  links: TypeBusinessChatLink[]; // Api.TypeBusinessChatLink[] -> TypeBusinessChatLink[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type ConnectedBots = {
  connectedBots: TypeConnectedBot[]; // Api.TypeConnectedBot[] -> TypeConnectedBot[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type ContentSettings = {
  // flags: null // null;
  sensitiveEnabled?: boolean; // boolean;
  sensitiveCanChange?: boolean; // boolean;
};

export type EmailVerified = {
  email: string; // string;
};

export type EmailVerifiedLogin = {
  email: string; // string;
  sentCode: TypeSentCode; // auth.TypeSentCode;
};

export type EmojiStatuses = {
  hash: string; // long -> string;
  statuses: TypeEmojiStatus[]; // Api.TypeEmojiStatus[] -> TypeEmojiStatus[];
};

export type Password = {
  // flags: null // null;
  hasRecovery?: boolean; // boolean;
  hasSecureValues?: boolean; // boolean;
  hasPassword?: boolean; // boolean;
  currentAlgo?: TypePasswordKdfAlgo; // Api.TypePasswordKdfAlgo -> TypePasswordKdfAlgo;
  srp_B?: Uint8Array; // bytes -> Uint8Array;
  srpId?: string; // long -> string;
  hint?: string; // string;
  emailUnconfirmedPattern?: string; // string;
  newAlgo: TypePasswordKdfAlgo; // Api.TypePasswordKdfAlgo -> TypePasswordKdfAlgo;
  newSecureAlgo: TypeSecurePasswordKdfAlgo; // Api.TypeSecurePasswordKdfAlgo -> TypeSecurePasswordKdfAlgo;
  secureRandom: Uint8Array; // bytes -> Uint8Array;
  pendingResetDate?: number; // int -> number;
  loginEmailPattern?: string; // string;
};

export type PasswordInputSettings = {
  // flags: null // null;
  newAlgo?: TypePasswordKdfAlgo; // Api.TypePasswordKdfAlgo -> TypePasswordKdfAlgo;
  newPasswordHash?: Uint8Array; // bytes -> Uint8Array;
  hint?: string; // string;
  email?: string; // string;
  newSecureSettings?: TypeSecureSecretSettings; // Api.TypeSecureSecretSettings -> TypeSecureSecretSettings;
};

export type PasswordSettings = {
  // flags: null // null;
  email?: string; // string;
  secureSettings?: TypeSecureSecretSettings; // Api.TypeSecureSecretSettings -> TypeSecureSecretSettings;
};

export type PrivacyRules = {
  rules: TypePrivacyRule[]; // Api.TypePrivacyRule[] -> TypePrivacyRule[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type ResetPasswordFailedWait = {
  retryDate: number; // int -> number;
};

export type ResetPasswordRequestedWait = {
  untilDate: number; // int -> number;
};

export type ResolvedBusinessChatLinks = {
  // flags: null // null;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  message: string; // string;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[] -> TypeMessageEntity[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type SavedRingtoneConverted = {
  document: TypeDocument; // Api.TypeDocument -> TypeDocument;
};

export type SavedRingtones = {
  hash: string; // long -> string;
  ringtones: TypeDocument[]; // Api.TypeDocument[] -> TypeDocument[];
};

export type SentEmailCode = {
  emailPattern: string; // string;
  length: number; // int -> number;
};

export type Takeout = {
  id: string; // long -> string;
};

export type Themes = {
  hash: string; // long -> string;
  themes: TypeTheme[]; // Api.TypeTheme[] -> TypeTheme[];
};

export type TmpPassword = {
  tmpPassword: Uint8Array; // bytes -> Uint8Array;
  validUntil: number; // int -> number;
};

export type WallPapers = {
  hash: string; // long -> string;
  wallpapers: TypeWallPaper[]; // Api.TypeWallPaper[] -> TypeWallPaper[];
};

export type WebAuthorizations = {
  authorizations: TypeWebAuthorization[]; // Api.TypeWebAuthorization[] -> TypeWebAuthorization[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type TypeAuthorizationForm = AuthorizationForm; // account.AuthorizationForm

export type TypeAuthorizations = Authorizations; // account.Authorizations

export type TypeAutoDownloadSettings = AutoDownloadSettings; // account.AutoDownloadSettings

export type TypeAutoSaveSettings = AutoSaveSettings; // account.AutoSaveSettings

export type TypeBusinessChatLinks = BusinessChatLinks; // account.BusinessChatLinks

export type TypeConnectedBots = ConnectedBots; // account.ConnectedBots

export type TypeContentSettings = ContentSettings; // account.ContentSettings

export type TypeEmailVerified = EmailVerified | EmailVerifiedLogin; // account.EmailVerified | account.EmailVerifiedLogin

export type TypeEmojiStatuses = EmojiStatusesNotModified | EmojiStatuses; // account.EmojiStatusesNotModified | account.EmojiStatuses

export type TypePassword = Password; // account.Password

export type TypePasswordInputSettings = PasswordInputSettings; // account.PasswordInputSettings

export type TypePasswordSettings = PasswordSettings; // account.PasswordSettings

export type TypePrivacyRules = PrivacyRules; // account.PrivacyRules

export type TypeResetPasswordResult =
  | ResetPasswordFailedWait
  | ResetPasswordRequestedWait
  | ResetPasswordOk; // account.ResetPasswordFailedWait | account.ResetPasswordRequestedWait | account.ResetPasswordOk

export type TypeResolvedBusinessChatLinks = ResolvedBusinessChatLinks; // account.ResolvedBusinessChatLinks

export type TypeSavedRingtone = SavedRingtone | SavedRingtoneConverted; // account.SavedRingtone | account.SavedRingtoneConverted

export type TypeSavedRingtones = SavedRingtonesNotModified | SavedRingtones; // account.SavedRingtonesNotModified | account.SavedRingtones

export type TypeSentEmailCode = SentEmailCode; // account.SentEmailCode

export type TypeTakeout = Takeout; // account.Takeout

export type TypeThemes = ThemesNotModified | Themes; // account.ThemesNotModified | account.Themes

export type TypeTmpPassword = TmpPassword; // account.TmpPassword

export type TypeWallPapers = WallPapersNotModified | WallPapers; // account.WallPapersNotModified | account.WallPapers

export type TypeWebAuthorizations = WebAuthorizations; // account.WebAuthorizations
