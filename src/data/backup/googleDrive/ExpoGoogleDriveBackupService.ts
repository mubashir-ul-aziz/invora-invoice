import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import {
  AuthRequest,
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
  revokeAsync,
  ResponseType,
  type TokenResponse,
} from 'expo-auth-session';
import * as Network from 'expo-network';

import type { DriveBackupFile } from '@/domain/backup/types';

import { DriveUnavailableError, NotSignedInError, OfflineError, type GoogleDriveBackupService } from './GoogleDriveBackupService';

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

/**
 * `drive.appdata` scopes access to *only* the hidden App Data folder — the
 * app can never see or touch the rest of the user's Drive, matching
 * `MVP_BUILD_PLAN.md`'s "Google Drive backup ... (App Data folder)".
 */
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.appdata'];

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

const TOKENS_STORAGE_KEY = 'invora_google_drive_tokens';
/** Refresh a bit before actual expiry so a request never starts with a token that expires mid-flight. */
const REFRESH_MARGIN_MS = 60_000;

interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch ms. */
  expiresAt: number | null;
}

/**
 * Real implementation of `GoogleDriveBackupService`, using `expo-auth-session`
 * for the OAuth 2.0 + PKCE authorization-code flow (per `MVP_BUILD_PLAN.md`
 * §2: "Google OAuth via expo-auth-session + Google Drive REST API") and the
 * Drive v3 REST API directly via `fetch` for the actual file operations — no
 * Google API client SDK dependency, per "no unnecessary packages".
 *
 * No Jest coverage — Jest can't drive a real browser-based OAuth flow or hit
 * a real Google endpoint, same reason every other native/network-backed
 * service in this codebase (`ExpoBiometricService`, `ExpoPdfService`) has
 * none; the request-building, token-refresh, and error-classification logic
 * this class contains is instead exercised indirectly through
 * `FakeGoogleDriveBackupService`, which every `BackupService` test uses.
 *
 * **Requires configuration this environment cannot provide**: a real Google
 * Cloud OAuth 2.0 client ID for this app's bundle id/package name, set as
 * `expo.extra.googleDriveClientId` in `app.json` (see "Known limitations" in
 * `IMPLEMENTATION_STATUS.md`). Without it, `signIn()` throws a clear,
 * actionable error instead of attempting a request that could never succeed.
 */
export class ExpoGoogleDriveBackupService implements GoogleDriveBackupService {
  private getClientId(): string | undefined {
    const extra = Constants.expoConfig?.extra as { googleDriveClientId?: string } | undefined;
    return extra?.googleDriveClientId || undefined;
  }

  private async loadTokens(): Promise<StoredTokens | null> {
    const raw = await SecureStore.getItemAsync(TOKENS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as StoredTokens;
    } catch {
      return null;
    }
  }

  private async saveTokens(tokens: StoredTokens): Promise<void> {
    await SecureStore.setItemAsync(TOKENS_STORAGE_KEY, JSON.stringify(tokens));
  }

  private async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKENS_STORAGE_KEY);
  }

  private toStoredTokens(response: TokenResponse, fallbackRefreshToken: string | null): StoredTokens {
    return {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken ?? fallbackRefreshToken,
      expiresAt: response.expiresIn ? Date.now() + response.expiresIn * 1000 : null,
    };
  }

  private async ensureOnline(): Promise<void> {
    try {
      const state = await Network.getNetworkStateAsync();
      if (state.isConnected === false || state.isInternetReachable === false) {
        throw new OfflineError();
      }
    } catch (err) {
      if (err instanceof OfflineError) {
        throw err;
      }
      // If the network-state check itself fails, fall through and let the
      // real request surface the actual problem instead of guessing.
    }
  }

  /** Returns a currently-valid access token, refreshing it first if it's expired/near-expiry. Throws `NotSignedInError` if there's no session to use/refresh. */
  private async getValidAccessToken(): Promise<string> {
    const tokens = await this.loadTokens();
    if (!tokens) {
      throw new NotSignedInError();
    }
    const isFresh = !tokens.expiresAt || tokens.expiresAt - REFRESH_MARGIN_MS > Date.now();
    if (isFresh) {
      return tokens.accessToken;
    }
    if (!tokens.refreshToken) {
      await this.clearTokens();
      throw new NotSignedInError('Your Google Drive session expired. Sign in again to continue backing up.');
    }
    const clientId = this.getClientId();
    if (!clientId) {
      throw new NotSignedInError();
    }
    try {
      const refreshed = await refreshAsync({ clientId, refreshToken: tokens.refreshToken }, GOOGLE_DISCOVERY);
      const next = this.toStoredTokens(refreshed, tokens.refreshToken);
      await this.saveTokens(next);
      return next.accessToken;
    } catch {
      await this.clearTokens();
      throw new NotSignedInError('Your Google Drive session expired. Sign in again to continue backing up.');
    }
  }

  async isSignedIn(): Promise<boolean> {
    return (await this.loadTokens()) !== null;
  }

  async signIn(): Promise<void> {
    await this.ensureOnline();
    const clientId = this.getClientId();
    if (!clientId) {
      throw new Error(
        'Google Drive backup is not configured for this build (missing Google OAuth client id). See IMPLEMENTATION_STATUS.md.',
      );
    }

    const request = new AuthRequest({
      clientId,
      scopes: DRIVE_SCOPES,
      redirectUri: makeRedirectUri({ scheme: 'invora' }),
      responseType: ResponseType.Code,
      usePKCE: true,
    });

    const result = await request.promptAsync(GOOGLE_DISCOVERY);
    if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new Error('Google sign-in was cancelled.');
    }
    if (result.type !== 'success' || !result.params.code) {
      throw new DriveUnavailableError('Google sign-in failed. Please try again.');
    }

    const tokenResponse = await exchangeCodeAsync(
      {
        clientId,
        code: result.params.code,
        redirectUri: request.redirectUri,
        extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
      },
      GOOGLE_DISCOVERY,
    );

    await this.saveTokens(this.toStoredTokens(tokenResponse, null));
  }

  async signOut(): Promise<void> {
    const tokens = await this.loadTokens();
    await this.clearTokens();
    const clientId = this.getClientId();
    if (tokens?.refreshToken && clientId) {
      // Best-effort — a failed revoke shouldn't block signing out locally.
      try {
        await revokeAsync({ clientId, token: tokens.refreshToken }, GOOGLE_DISCOVERY);
      } catch {
        // Ignored — the local session is already cleared either way.
      }
    }
  }

  private async driveFetch(url: string, init: RequestInit, isRetry = false): Promise<Response> {
    await this.ensureOnline();
    const accessToken = await this.getValidAccessToken();

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      throw new OfflineError();
    }

    if (response.status === 401 && !isRetry) {
      // The access token was rejected outright (e.g. revoked mid-session) —
      // one retry after clearing it forces a fresh refresh attempt.
      await this.clearTokens();
      return this.driveFetch(url, init, true);
    }
    if (!response.ok) {
      throw new DriveUnavailableError(`Google Drive returned an error (HTTP ${response.status}).`);
    }
    return response;
  }

  async uploadBackup(fileName: string, content: string): Promise<DriveBackupFile> {
    const boundary = `invora-backup-${Date.now()}`;
    const metadata = JSON.stringify({ name: fileName, parents: ['appDataFolder'] });
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${content}\r\n` +
      `--${boundary}--`;

    const response = await this.driveFetch(
      `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,createdTime,size`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    const json = (await response.json()) as { id: string; name: string; createdTime: string; size?: string };
    return {
      id: json.id,
      name: json.name,
      createdAt: json.createdTime,
      sizeBytes: json.size ? Number(json.size) : content.length,
    };
  }

  async listBackups(): Promise<DriveBackupFile[]> {
    const response = await this.driveFetch(
      `${DRIVE_FILES_URL}?spaces=appDataFolder&fields=files(id,name,createdTime,size)&orderBy=createdTime desc&pageSize=100`,
      { method: 'GET' },
    );
    const json = (await response.json()) as {
      files?: { id: string; name: string; createdTime: string; size?: string }[];
    };
    return (json.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: f.createdTime,
      sizeBytes: f.size ? Number(f.size) : null,
    }));
  }

  async downloadBackup(fileId: string): Promise<string> {
    const response = await this.driveFetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, { method: 'GET' });
    return response.text();
  }

  async deleteBackup(fileId: string): Promise<void> {
    await this.driveFetch(`${DRIVE_FILES_URL}/${fileId}`, { method: 'DELETE' });
  }
}
