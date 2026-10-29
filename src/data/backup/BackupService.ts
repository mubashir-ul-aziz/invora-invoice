import { backupFileName } from '@/domain/backup/formatting';
import { BACKUP_RETENTION_COUNT, type BackupLogEntry, type BackupTrigger, type DriveBackupFile } from '@/domain/backup/types';

import type { BackupLogRepository } from './BackupLogRepository';
import type { BackupPayloadService } from './BackupPayloadService';
import type { BackupSettingsRepository } from './BackupSettingsRepository';
import type { GoogleDriveBackupService } from './googleDrive/GoogleDriveBackupService';

function errorMessageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The Google Drive half of backup (Phase 11): "Back up to Drive" (manual and
 * the automatic trigger, which reuse the same `backupNow()`), listing,
 * downloading and deleting Drive backups. Every backup attempt is logged
 * (success *and* failure) with the Drive file id, so the history can restore,
 * share or delete it later, and old Drive backups are only pruned *after* a
 * new one is confirmed uploaded.
 *
 * Restoring is not done here: every restore — from Drive, a local file or an
 * imported file — goes through `BackupRestoreService`, which validates the
 * file, takes a safety backup first, and only then replaces the data.
 */
export class BackupService {
  constructor(
    private readonly payloads: BackupPayloadService,
    private readonly logRepository: BackupLogRepository,
    private readonly settingsRepository: BackupSettingsRepository,
    private readonly driveService: GoogleDriveBackupService,
    private readonly now: () => number = Date.now,
  ) {}

  async listRemoteBackups(): Promise<DriveBackupFile[]> {
    return this.driveService.listBackups();
  }

  /**
   * Builds the shared backup payload and uploads it to the Drive App Data
   * folder. Always ends by recording a `BackupLogEntry` and updating
   * `BackupSettings` — on failure, the local database is never touched (this
   * only ever *reads* it), so "Backup Now" failing is always safe.
   */
  async backupNow(trigger: BackupTrigger): Promise<BackupLogEntry> {
    const startedAt = this.now();
    try {
      const signedIn = await this.driveService.isSignedIn();
      if (!signedIn) {
        throw new Error('Sign in with Google Drive before backing up.');
      }

      const created = await this.payloads.create(startedAt);
      const fileName = backupFileName(startedAt);
      const uploaded = await this.driveService.uploadBackup(fileName, created.content);
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
        formatVersion: created.payload.formatVersion,
        sizeBytes: created.sizeBytes,
        counts: created.counts,
        errorMessage: null,
        fileName: uploaded.name || fileName,
        remoteFileId: uploaded.id,
      });
    } catch (err) {
      const message = errorMessageOf(err);
      const finishedAt = this.now();
      await this.settingsRepository.recordAttempt({
        status: 'failure',
        finishedAt: new Date(finishedAt).toISOString(),
        errorMessage: message,
      });
      return this.logRepository.add({
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
    }
  }

  /** The raw content of one Drive backup. Throws the Drive service's typed errors (offline, not signed in, unavailable). */
  async downloadBackup(fileId: string): Promise<string> {
    if (!(await this.driveService.isSignedIn())) {
      throw new Error('Sign in with Google Drive to use this backup.');
    }
    return this.driveService.downloadBackup(fileId);
  }

  /** Deletes a backup file from Google Drive, and its history row if there is one. */
  async deleteRemoteBackup(fileId: string, logEntryId: string | null): Promise<void> {
    await this.driveService.deleteBackup(fileId);
    if (logEntryId) {
      await this.logRepository.remove(logEntryId);
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
