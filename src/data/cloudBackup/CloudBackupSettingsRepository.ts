import type { BackupOutcome } from '@/domain/backup/types';
import type { CloudBackupSettings, CloudBackupSettingsInput, CloudStoragePlanId } from '@/domain/cloudBackup/types';

/** The result of one cloud backup attempt, recorded onto `CloudBackupSettings` — see `recordAttempt()`. Mirrors `BackupAttemptResult` (Phase 11). */
export interface CloudBackupAttemptResult {
  status: BackupOutcome;
  /** Only meaningful when `status === 'success'`; becomes the new `lastCloudBackupAt`. */
  finishedAt: string;
  errorMessage: string | null;
}

/**
 * The Cloud Backup enabled/disabled toggle + "last backup time /
 * success-failure" + known plan fields. Backed by the *same* `app_settings`
 * singleton row `SecurityRepository`/`BackupSettingsRepository` already use
 * (see the doc comment on `appSettings` in `data/db/schema.ts`) — this
 * repository only ever writes the five columns it owns, the same "share one
 * row without clobbering" convention every prior phase extending that table
 * established.
 */
export interface CloudBackupSettingsRepository {
  /** Returns the saved settings, defaulting to "off, never backed up, unknown plan" if none were ever saved. */
  getSettings(): Promise<CloudBackupSettings>;
  /** Saves just the `cloudBackupEnabled` preference — never touches the last-attempt/plan fields. */
  saveSettings(input: CloudBackupSettingsInput): Promise<CloudBackupSettings>;
  /** Records the outcome of one cloud backup attempt — updates the last-status/error fields always, and `lastCloudBackupAt` only on success. */
  recordAttempt(result: CloudBackupAttemptResult): Promise<CloudBackupSettings>;
  /** Records the plan a `getStorageUsage()` call last reported this device on — informational only, doesn't count as a backup attempt. */
  recordPlan(planId: CloudStoragePlanId): Promise<CloudBackupSettings>;
}
