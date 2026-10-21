/**
 * Auth-related Telegram types.
 * - TL constructor `authorization` (device session)
 * - auth.* namespace results (login / sent code / tokens)
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import type { TypeUser } from './users';
import type { TypeTermsOfService } from './help';

// --- TL constructor: authorization (device session) ---

/**
 * @see https://core.telegram.org/constructor/authorization
 * Not to be confused with auth.Authorization (login result) → AuthAuthorization.
 */
export type Authorization = {
  current?: boolean;
  officialApp?: boolean;
  passwordPending?: boolean;
  encryptedRequestsDisabled?: boolean;
  callRequestsDisabled?: boolean;
  unconfirmed?: boolean;
  hash: string;
  deviceModel: string;
  platform: string;
  systemVersion: string;
  apiId: number;
  appName: string;
  appVersion: string;
  dateCreated: number;
  dateActive: number;
  ip: string;
  country: string;
  region: string;
};

/** GramJS `Api.TypeAuthorization` — device session constructor. */
export type TypeAuthorization = Authorization;

// --- auth.* namespace results ---

/** auth.Authorization — successful login payload (not the device session constructor). */
export type AuthAuthorization = {
  setupPasswordRequired?: boolean;
  otherwiseReloginDays?: number;
  tmpSessions?: number;
  futureAuthToken?: Uint8Array;
  user: TypeUser;
};

export type AuthorizationSignUpRequired = {
  termsOfService?: TypeTermsOfService;
};

export type ExportedAuthorization = {
  id: string;
  bytes: Uint8Array;
};

export type LoggedOut = {
  futureAuthToken?: Uint8Array;
};

export type LoginToken = {
  expires: number;
  token: Uint8Array;
};

export type LoginTokenMigrateTo = {
  dcId: number;
  token: Uint8Array;
};

export type LoginTokenSuccess = {
  authorization: TypeAuthAuthorization;
};

export type PasswordRecovery = {
  emailPattern: string;
};

export type SentCode = {
  type: TypeSentCodeType;
  phoneCodeHash: string;
  nextType?: TypeCodeType;
  timeout?: number;
};

export type SentCodeSuccess = {
  authorization: TypeAuthAuthorization;
};

export type SentCodeTypeApp = {
  length: number;
};

export type SentCodeTypeCall = {
  length: number;
};

export type SentCodeTypeEmailCode = {
  appleSigninAllowed?: boolean;
  googleSigninAllowed?: boolean;
  emailPattern: string;
  length: number;
  resetAvailablePeriod?: number;
  resetPendingDate?: number;
};

export type SentCodeTypeFirebaseSms = {
  nonce?: Uint8Array;
  playIntegrityProjectId?: string;
  playIntegrityNonce?: Uint8Array;
  receipt?: string;
  pushTimeout?: number;
  length: number;
};

export type SentCodeTypeFlashCall = {
  pattern: string;
};

export type SentCodeTypeFragmentSms = {
  url: string;
  length: number;
};

export type SentCodeTypeMissedCall = {
  prefix: string;
  length: number;
};

export type SentCodeTypeSetUpEmailRequired = {
  appleSigninAllowed?: boolean;
  googleSigninAllowed?: boolean;
};

export type SentCodeTypeSms = {
  length: number;
};

export type SentCodeTypeSmsPhrase = {
  beginning?: string;
};

export type SentCodeTypeSmsWord = {
  beginning?: string;
};

export type CodeTypeSms = Record<string, never>;
export type CodeTypeCall = Record<string, never>;
export type CodeTypeFlashCall = {
  pattern: string;
};
export type CodeTypeMissedCall = {
  prefix: string;
  length: number;
};
export type CodeTypeFragmentSms = Record<string, never>;

/** auth.Authorization | auth.AuthorizationSignUpRequired */
export type TypeAuthAuthorization = AuthAuthorization | AuthorizationSignUpRequired;

export type TypeCodeType =
  | CodeTypeSms
  | CodeTypeCall
  | CodeTypeFlashCall
  | CodeTypeMissedCall
  | CodeTypeFragmentSms;

export type TypeExportedAuthorization = ExportedAuthorization;

export type TypeLoggedOut = LoggedOut;

export type TypeLoginToken = LoginToken | LoginTokenMigrateTo | LoginTokenSuccess;

export type TypePasswordRecovery = PasswordRecovery;

export type TypeSentCode = SentCode | SentCodeSuccess;

export type TypeSentCodeType =
  | SentCodeTypeApp
  | SentCodeTypeSms
  | SentCodeTypeCall
  | SentCodeTypeFlashCall
  | SentCodeTypeMissedCall
  | SentCodeTypeEmailCode
  | SentCodeTypeSetUpEmailRequired
  | SentCodeTypeFragmentSms
  | SentCodeTypeFirebaseSms
  | SentCodeTypeSmsWord
  | SentCodeTypeSmsPhrase;
