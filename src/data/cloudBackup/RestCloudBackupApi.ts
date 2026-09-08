import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import * as Network from 'expo-network';

import type { CloudBackupFile, CloudStorageUsage } from '@/domain/cloudBackup/types';

import {
  CloudBackupNotConfiguredError,
  CloudBackupOfflineError,
  CloudBackupUnavailableError,
  CloudStorageLimitExceededError,
  type CloudBackupApi,
} from './CloudBackupApi';
import type { EncryptedBackupEnvelope } from './encryption/BackupEncryptionService';

const DEVICE_TOKEN_STORAGE_KEY = 'invora_cloud_backup_device_token';

/**
 * Real implementation of `CloudBackupApi` — a plain `fetch` client against
 * the REST contract documented on the interface, no cloud SDK dependency,
 * matching how `ExpoGoogleDriveBackupService` (Phase 11) calls Drive's REST
 * API directly rather than pulling in Google's client library.
 *
 * **Requires configuration this environment cannot provide**: a deployed
 * backend URL, set as `expo.extra.cloudBackupApiUrl` in `app.json` (currently
 * `""`, per `MVP_BUILD_PLAN.md` §10's still-open "Optional cloud backup
 * backend" decision — no such service has been built or chosen yet). Without
 * it, every method throws `CloudBackupNotConfiguredError` immediately
 * instead of attempting a request that could never succeed — the same
 * pattern `ExpoGoogleDriveBackupService.signIn()` uses for its missing OAuth
 * client id.
 *
 * No Jest coverage — same "native/network, no device or deployed backend in
 * this environment" reasoning as `ExpoGoogleDriveBackupService`; its
 * request-building and error-classification logic is instead exercised
 * indirectly through `FakeCloudBackupApi`, which every `CloudBackupService`
 * test uses.
 */
export class RestCloudBackupApi implements CloudBackupApi {
  private getBaseUrl(): string | undefined {
    const extra = Constants.expoConfig?.extra as { cloudBackupApiUrl?: string } | undefined;
    return extra?.cloudBackupApiUrl || undefined;
  }

  private async ensureOnline(): Promise<void> {
    try {
      const state = await Network.getNetworkStateAsync();
      if (state.isConnected === false || state.isInternetReachable === false) {
        throw new CloudBackupOfflineError();
      }
    } catch (err) {
      if (err instanceof CloudBackupOfflineError) {
        throw err;
      }
      // If the network-state check itself fails, fall through and let the real request surface the actual problem.
    }
  }

  /** Registers this device on first use and caches the resulting token — no email/password, no billing fields (see the doc comment on `CloudBackupApi`). */
  private async getOrRegisterDeviceToken(baseUrl: string): Promise<string> {
    const stored = await SecureStore.getItemAsync(DEVICE_TOKEN_STORAGE_KEY);
    if (stored) {
      return stored;
    }
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/devices/register`, { method: 'POST' });
    } catch {
      throw new CloudBackupOfflineError();
    }
    if (!response.ok) {
      throw new CloudBackupUnavailableError(`Cloud backup registration failed (HTTP ${response.status}).`);
    }
    const json = (await response.json()) as { deviceToken: string };
    await SecureStore.setItemAsync(DEVICE_TOKEN_STORAGE_KEY, json.deviceToken);
    return json.deviceToken;
  }

  private async apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      throw new CloudBackupNotConfiguredError();
    }
    await this.ensureOnline();
    const token = await this.getOrRegisterDeviceToken(baseUrl);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
    } catch {
      throw new CloudBackupOfflineError();
    }
    if (response.status === 413) {
      throw new CloudStorageLimitExceededError();
    }
    if (!response.ok) {
      throw new CloudBackupUnavailableError(`Cloud backup returned an error (HTTP ${response.status}).`);
    }
    return response;
  }

  async getStorageUsage(): Promise<CloudStorageUsage> {
    const response = await this.apiFetch('/v1/storage', { method: 'GET' });
    return (await response.json()) as CloudStorageUsage;
  }

  async uploadBackup(fileName: string, envelope: EncryptedBackupEnvelope): Promise<CloudBackupFile> {
    const response = await this.apiFetch('/v1/backups', {
      method: 'POST',
      body: JSON.stringify({ name: fileName, envelope }),
    });
    return (await response.json()) as CloudBackupFile;
  }

  async listBackups(): Promise<CloudBackupFile[]> {
    const response = await this.apiFetch('/v1/backups', { method: 'GET' });
    return (await response.json()) as CloudBackupFile[];
  }

  async downloadBackup(fileId: string): Promise<EncryptedBackupEnvelope> {
    const response = await this.apiFetch(`/v1/backups/${fileId}`, { method: 'GET' });
    const json = (await response.json()) as { envelope: EncryptedBackupEnvelope };
    return json.envelope;
  }

  async deleteBackup(fileId: string): Promise<void> {
    await this.apiFetch(`/v1/backups/${fileId}`, { method: 'DELETE' });
  }
}
