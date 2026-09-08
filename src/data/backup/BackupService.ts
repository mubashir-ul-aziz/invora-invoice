import { buildBackupPayload, validateBackupPayload } from '@/domain/backup/validation';
import {
  BACKUP_RETENTION_COUNT,
  countBackupTables,
  type BackupLogEntry,
  type BackupTrigger,
  type DriveBackupFile,
} from '@/domain/backup/types';

import type { BackupLogRepository } from './BackupLogRepository';
import type { BackupRepository } from './BackupRepository';
import type { BackupSettingsRepository } from './BackupSettingsRepository';
import type { GoogleDriveBackupService } from './googleDrive/GoogleDriveBackupService';

const BACKUP_FILE_PREFIX = 'invora-backup-';

function backupFileName(createdAt: number): string {
  return `${BACKUP_FILE_PREFIX}${new Date(createdAt).toISOString().replace(/[:.]/g, '-')}.json`;
}

function errorMessageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The use-case layer Phase 11's screens/store actually call —
 * `BackupScreen`/`backupStore` never talk to `BackupRepository` or
 * `GoogleDriveBackupService` directly, same "screens depend only on
 * interfaces" rule every other phase followed. Owns the two operations the
 * brief names (manual "Backup Now" / "Restore Backup", plus the automatic
 * trigger reusing the same `backupNow()`), and everything the "PROTECT
 * AGAINST" list requires: every attempt is logged (success *and* failure),
 * a corrupted/incompatible/malformed backup is rejected before
 * `BackupRepository.restoreAll()` is ever called (see
 * `validateBackupPayload()`), and old remote backups are only pruned *after*
 * a new one is confirmed uploaded.
 */
export class BackupService {
  constructor(
    private readonly backupRepository: BackupRepository,
    private readonly logRepository: BackupLogRepository,
    private readonly settingsRepository: BackupSettingsRepository,
    private readonly driveService: GoogleDriveBackupService,
    private readonly appVersion: string,
    private readonly now: () => number = Date.now,
  ) {}

  async listRemoteBackups(): Promise<DriveBackupFile[]> {
    return this.driveService.listBackups();
  }

  /**
   * Exports every table, wraps it in a versioned+checksummed envelope, and
   * uploads it to the Drive App Data folder. Always ends by recording a
   * `BackupLogEntry` and updating `BackupSettings` — on failure, the local
   * database is never touched (this only ever *reads* it), so "Backup Now"
   * failing is always safe by construction, unlike restore.
   */
  async backupNow(trigger: BackupTrigger): Promise<BackupLogEntry> {
    const startedAt = this.now();
    try {
      const signedIn = await this.driveService.isSignedIn();
      if (!signedIn) {
        throw new Error('Sign in with Google Drive before backing up.');
      }

      const tables = await this.backupRepository.exportAll();
      const payload = buildBackupPayload(tables, this.appVersion, startedAt);
      const content = JSON.stringify(payload);
      const counts = countBackupTables(tables);

      await this.driveService.uploadBackup(backupFileName(startedAt), content);
      await this.pruneOldBackups();

      const finishedAt = this.now();
      await this.settingsRepository.recordAttempt({
        status: 'success',
        finishedAt: new Date(finishedAt).toISOString(),
        errorMessage: null,
      });
      return this.logRepository.add({
        direction: 'backup',
        trigger,
        status: 'success',
        destination: 'google_drive',
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(finishedAt).toISOString(),
        formatVersion: payload.formatVersion,
        sizeBytes: content.length,
        counts,
        errorMessage: null,
      });
    } catch (err) {
      const message = errorMessageOf(err);
      const finishedAt = this.now();
      await this.settingsRepository.recordAttempt({
        status: 'failure',
        finishedAt: new Date(finishedAt).toISOString(),
        errorMessage: message,
      });
      const entry = await this.logRepository.add({
        direction: 'backup',
        trigger,
        status: 'failure',
        destination: 'google_drive',
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(finishedAt).toISOString(),
        formatVersion: null,
        sizeBytes: null,
        counts: null,
        errorMessage: message,
      });
      return entry;
    }
  }

  /**
   * Downloads and validates the chosen backup file, then — only once it's
   * proven structurally sound, version-compatible, and checksum-intact —
   * replaces the local database via `BackupRepository.restoreAll()`, which
   * is itself atomic (see its doc comment). If validation fails, or
   * `restoreAll()` itself throws, the local database is left exactly as it
   * was: this method never calls `restoreAll()` with unvalidated data, and
   * `restoreAll()` never partially applies a restore — see the "IMPORTANT
   * SAFETY RULE" in `MVP_BUILD_PLAN.md`.
   */
  async restoreBackup(fileId: string, trigger: BackupTrigger = 'manual'): Promise<BackupLogEntry> {
    const startedAt = this.now();
    try {
      const signedIn = await this.driveService.isSignedIn();
      if (!signedIn) {
        throw new Error('Sign in with Google Drive before restoring.');
      }

      const raw = await this.driveService.downloadBackup(fileId);
      const payload = validateBackupPayload(raw); // throws BackupValidationError — local DB untouched.
      await this.backupRepository.restoreAll(payload.tables); // atomic — see SqliteBackupRepository.

      const finishedAt = this.now();
      return await this.logRepository.add({
        direction: 'restore',
        trigger,
        status: 'success',
        destination: 'google_drive',
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(finishedAt).toISOString(),
        formatVersion: payload.formatVersion,
        sizeBytes: raw.length,
        counts: countBackupTables(payload.tables),
        errorMessage: null,
      });
    } catch (err) {
      const message = errorMessageOf(err);
      return this.logRepository.add({
        direction: 'restore',
        trigger,
        status: 'failure',
        destination: 'google_drive',
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(this.now()).toISOString(),
        formatVersion: null,
        sizeBytes: null,
        counts: null,
        errorMessage: message,
      });
    }
  }

  /** Deletes the oldest remote backups beyond `BACKUP_RETENTION_COUNT`, called only after a new upload is confirmed — never before, so a failed backup never costs an existing good one. Best-effort: a pruning failure doesn't fail the backup that triggered it. */
  private async pruneOldBackups(): Promise<void> {
    try {
      const files = await this.driveService.listBackups();
      const sorted = [...files].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const stale = sorted.slice(BACKUP_RETENTION_COUNT);
      for (const file of stale) {
        await this.driveService.deleteBackup(file.id);
      }
    } catch {
      // Retention is a housekeeping nicety, not part of the safety contract — ignored.
    }
  }
}
