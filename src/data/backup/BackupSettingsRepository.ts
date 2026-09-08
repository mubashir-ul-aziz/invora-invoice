import type { BackupOutcome, BackupSettings, BackupSettingsInput } from '@/domain/backup/types';

/** The result of one backup attempt, recorded onto `BackupSettings` — see `recordAttempt()`. */
export interface BackupAttemptResult {
  status: BackupOutcome;
  /** Only meaningful when `status === 'success'`; becomes the new `lastBackupAt`. */
  finishedAt: string;
  errorMessage: string | null;
}

/**
 * The Automatic Backup toggle + "last backup time / success-failure" fields
 * the brief asks for. Backed by the *same* `app_settings` singleton row
 * `SecurityRepository` uses (see the doc comment on `appSettings` in
 * `data/db/schema.ts`) — each repository only ever writes the columns it
 * owns, the same "share one row without clobbering" convention Phase 2
 * established for `business`.
 */
export interface BackupSettingsRepository {
  /** Returns the saved settings, defaulting to "off, never backed up" if none were ever saved. */
  getSettings(): Promise<BackupSettings>;
  /** Saves just the `autoBackupEnabled` preference — never touches `lastBackupAt`/`lastBackupStatus`, which only `recordAttempt()` updates. */
  saveSettings(input: BackupSettingsInput): Promise<BackupSettings>;
  /** Records the outcome of one backup attempt (called by `BackupService` after every attempt, success or failure) — updates `lastBackupStatus`/`lastBackupError` always, and `lastBackupAt` only on success. */
  recordAttempt(result: BackupAttemptResult): Promise<BackupSettings>;
}
