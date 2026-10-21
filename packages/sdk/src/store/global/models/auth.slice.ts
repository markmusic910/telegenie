import { toJS } from 'mobx';
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

  constructor() {
    super();
    this.observe();
  }

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
    };
  }
}
