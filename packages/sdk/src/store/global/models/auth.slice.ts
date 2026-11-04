import { toJS } from 'mobx';
import {
  BACKEND_BOT_USERNAME,
  type BackendAuthStatus,
  type BackendUserProfile,
} from '@telegenie/config';
import type { UserEntity } from '../../types';
import { GlobalStoreSlice } from '../global-store.slice';

export type AuthStep = 'idle' | 'phone' | 'code' | 'password' | 'success' | 'error';

export class AuthSlice extends GlobalStoreSlice {
  currentUser: UserEntity | null = null;
  authStep: AuthStep = 'idle';
  authIsLoading = false;
  authError: string | null = null;
  authPasswordHint: string | undefined = undefined;
  authSessionString: string | null = null;
  authIsCodeViaApp = false;
  authPhoneNumber = '';
  authPhoneCodeHash = '';

  backendToken: string | null = null;
  backendUserProfile: BackendUserProfile | null = null;
  backendAuthStatus: BackendAuthStatus = 'idle';
  backendAuthError: string | null = null;
  backendBotUsername: string = BACKEND_BOT_USERNAME;
  backendChallengeNonce: string | null = null;

  constructor() {
    super();
    this.observe();
  }

  setBackendAuthStatus = (status: BackendAuthStatus) => {
    this.backendAuthStatus = status;
  };

  setBackendToken = (token: string | null) => {
    this.backendToken = token;
  };

  setBackendUserProfile = (profile: BackendUserProfile | null) => {
    this.backendUserProfile = profile;
  };

  setBackendAuthError = (error: string | null) => {
    this.backendAuthError = error;
  };

  setBackendChallenge = (nonce: string | null, botUsername = BACKEND_BOT_USERNAME) => {
    this.backendChallengeNonce = nonce;
    this.backendBotUsername = botUsername;
  };

  resetBackendAuth = () => {
    this.backendToken = null;
    this.backendUserProfile = null;
    this.backendAuthStatus = 'idle';
    this.backendAuthError = null;
    this.backendChallengeNonce = null;
  };

  setAuthStep = (step: AuthStep) => {
    this.authStep = step;
  };

  setAuthLoading = (loading: boolean) => {
    this.authIsLoading = loading;
  };

  setAuthError = (error: string | null) => {
    this.authError = error;
  };

  setAuthPasswordHint = (hint: string | undefined) => {
    this.authPasswordHint = hint;
  };

  setAuthSessionString = (sessionString: string | null) => {
    this.authSessionString = sessionString;
  };

  setAuthIsCodeViaApp = (isCodeViaApp: boolean) => {
    this.authIsCodeViaApp = isCodeViaApp;
  };

  setAuthPhoneNumber = (phoneNumber: string) => {
    this.authPhoneNumber = phoneNumber;
  };

  setAuthPhoneCodeHash = (phoneCodeHash: string) => {
    this.authPhoneCodeHash = phoneCodeHash;
  };

  resetAuth = () => {
    this.authPhoneNumber = '';
    this.authPhoneCodeHash = '';
    this.authError = null;
    this.authPasswordHint = undefined;
    this.authIsCodeViaApp = false;
    this.authStep = 'phone';
  };

  hydrateFromSnapshot = (_snapshot: Record<string, unknown> | undefined) => {
    // Auth is applied in TeleGenieSDK.applyGlobalSnapshot, not the app snapshot.
  };

  toJS() {
    return {
      currentUser: toJS(this.currentUser),
      authStep: this.authStep,
      authIsLoading: this.authIsLoading,
      authError: this.authError,
      authPasswordHint: this.authPasswordHint,
      authSessionString: this.authSessionString,
      authIsCodeViaApp: this.authIsCodeViaApp,
      authPhoneNumber: this.authPhoneNumber,
      authPhoneCodeHash: this.authPhoneCodeHash,
      backendToken: this.backendToken,
      backendUserProfile: toJS(this.backendUserProfile),
      backendAuthStatus: this.backendAuthStatus,
      backendAuthError: this.backendAuthError,
      backendBotUsername: this.backendBotUsername,
      backendChallengeNonce: this.backendChallengeNonce,
    };
  }
}
