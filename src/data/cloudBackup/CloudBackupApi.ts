import type { CloudBackupFile, CloudStorageUsage } from '@/domain/cloudBackup/types';

import type { EncryptedBackupEnvelope } from './encryption/BackupEncryptionService';

/** No network path to the cloud API at all (airplane mode, no Wi-Fi/cell) — mirrors `OfflineError` in `data/backup/googleDrive/GoogleDriveBackupService.ts`. */
export class CloudBackupOfflineError extends Error {
  constructor(message = "You're offline — connect to the internet to use cloud backup.") {
    super(message);
    this.name = 'CloudBackupOfflineError';
  }
}

/** The device is online but the cloud API itself rejects/fails the request (outage, rate limit, a non-2xx response). */
export class CloudBackupUnavailableError extends Error {
  constructor(message = "Cloud backup isn't available right now. Try again in a moment.") {
    super(message);
    this.name = 'CloudBackupUnavailableError';
  }
}

/**
 * Thrown by every `CloudBackupApi` method when this build has no cloud
 * backend to talk to — `expo.extra.cloudBackupApiUrl` is unset. Distinct
 * from `CloudBackupUnavailableError` (a *real* backend that's having
 * trouble) so the UI can say "not set up yet" instead of "try again later" —
 * see `RestCloudBackupApi` and the "Known limitations" note this mirrors
 * from Phase 11's Google OAuth client id gap.
 */
export class CloudBackupNotConfiguredError extends Error {
  constructor(
    message = 'Cloud backup is not configured for this build yet. See IMPLEMENTATION_STATUS.md.',
  ) {
    super(message);
    this.name = 'CloudBackupNotConfiguredError';
  }
}

/** The upload would put this device over its plan's storage limit — the concrete mechanism behind the "Storage limits" requirement. */
export class CloudStorageLimitExceededError extends Error {
  constructor(
    message = "You've reached your cloud storage limit. Delete an old backup or upgrade your plan to back up again.",
  ) {
    super(message);
    this.name = 'CloudStorageLimitExceededError';
  }
}

/**
 * The one door `CloudBackupService` uses to reach the cloud backend —
 * documents the architecture's "Cloud API" tier
 * (`Mobile SQLite → versioned/encrypted backup → Cloud API → Object storage`,
 * `MVP_BUILD_PLAN.md` §"Architecture"). Like `GoogleDriveBackupService`,
 * this is never a live data source — only a place to put/get whole,
 * already-encrypted backup files (`CloudBackupService` encrypts via
 * `BackupEncryptionService` before calling `uploadBackup()`, and decrypts
 * what `downloadBackup()` returns before it's validated/restored).
 *
 * **Documented REST contract** (the small backend `MVP_BUILD_PLAN.md` §10
 * flags as still undecided — this is the shape `RestCloudBackupApi` calls,
 * not yet a deployed service):
 *
 * - `POST {baseUrl}/v1/devices/register` → `{ deviceToken }` — called once,
 *   lazily, the first time the device needs a token; no email/password, no
 *   billing fields, matching "do not implement a complicated billing
 *   system" — this is device registration, not a user account.
 * - `GET {baseUrl}/v1/storage` (`Authorization: Bearer <deviceToken>`) →
 *   `{ usedBytes, limitBytes, planId }`.
 * - `POST {baseUrl}/v1/backups` (`{ name, envelope }`) →
 *   `{ id, name, createdAt, sizeBytes }`; the server responds `413` (mapped
 *   to `CloudStorageLimitExceededError`) if the upload would exceed the
 *   plan limit instead of accepting a backup it can't actually store.
 * - `GET {baseUrl}/v1/backups` → `CloudBackupFile[]`, newest first.
 * - `GET {baseUrl}/v1/backups/:id` → `{ envelope }`.
 * - `DELETE {baseUrl}/v1/backups/:id` → `204`.
 */
export interface CloudBackupApi {
  getStorageUsage(): Promise<CloudStorageUsage>;
  uploadBackup(fileName: string, envelope: EncryptedBackupEnvelope): Promise<CloudBackupFile>;
  /** Every backup file this device has stored, newest first. */
  listBackups(): Promise<CloudBackupFile[]>;
  downloadBackup(fileId: string): Promise<EncryptedBackupEnvelope>;
  deleteBackup(fileId: string): Promise<void>;
}
