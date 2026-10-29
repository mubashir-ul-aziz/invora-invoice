import { backupFileName } from '@/domain/backup/formatting';
import type { BackupLogEntry, BackupTrigger } from '@/domain/backup/types';

import type { BackupLogRepository } from './BackupLogRepository';
import type { BackupPayloadService } from './BackupPayloadService';
import type { LocalBackupFileStore } from './files/LocalBackupFileStore';

function errorMessageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** A local backup attempt's log entry, plus — on success — where the logo came from (for cleanup after a restore). */
export interface LocalBackupResult {
  entry: BackupLogEntry;
  sourceLogoUri: string | null;
}

/**
 * Backups written to this device's own storage: "Export Backup" and the
 * safety backup taken before every restore. Each one is a durable file in
 * `LocalBackupFileStore` plus a `backup_log` row pointing at it, so it shows
 * in the history and can be shared, restored or deleted later. Making a
 * backup only ever *reads* the database.
 */
export class LocalBackupService {
  constructor(
    private readonly payloads: BackupPayloadService,
    private readonly files: LocalBackupFileStore,
    private readonly logRepository: BackupLogRepository,
    private readonly now: () => number = Date.now,
  ) {}

  /** "Export Backup". Always logs the attempt; a failure is returned as a `'failure'` entry, never thrown. */
  async exportBackup(): Promise<BackupLogEntry> {
    return (await this.write('manual')).entry;
  }

  /** The copy of the current data taken right before a restore. The caller must abort the restore unless this succeeds. */
  async createSafetyBackup(): Promise<LocalBackupResult> {
    return this.write('safety');
  }

  private async write(trigger: Extract<BackupTrigger, 'manual' | 'safety'>): Promise<LocalBackupResult> {
    const startedAt = this.now();
    try {
      const created = await this.payloads.create(startedAt);
      const saved = await this.files.write(backupFileName(startedAt, trigger === 'safety' ? 'safety' : 'backup'), created.content);
      const entry = await this.logRepository.add({
        direction: 'backup',
        trigger,
        status: 'success',
        destination: 'local',
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(this.now()).toISOString(),
        formatVersion: created.payload.formatVersion,
        sizeBytes: saved.sizeBytes,
        counts: created.counts,
        errorMessage: null,
        fileName: saved.fileName,
        fileUri: saved.uri,
      });
      return { entry, sourceLogoUri: created.sourceLogoUri };
    } catch (err) {
      const entry = await this.logRepository.add({
        direction: 'backup',
        trigger,
        status: 'failure',
        destination: 'local',
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(this.now()).toISOString(),
        formatVersion: null,
        sizeBytes: null,
        counts: null,
        errorMessage: errorMessageOf(err),
      });
      return { entry, sourceLogoUri: null };
    }
  }

  async read(entry: BackupLogEntry): Promise<string> {
    if (!entry.fileUri) {
      throw new Error('This history entry has no backup file.');
    }
    if (!(await this.files.exists(entry.fileUri))) {
      throw new Error('This backup file is no longer on this device.');
    }
    return this.files.read(entry.fileUri);
  }

  /** Deletes the local file and its history row. */
  async delete(entry: BackupLogEntry): Promise<void> {
    if (entry.fileUri) {
      await this.files.delete(entry.fileUri);
    }
    await this.logRepository.remove(entry.id);
  }
}
