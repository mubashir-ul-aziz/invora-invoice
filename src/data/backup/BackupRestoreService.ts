import { MAX_BACKUP_FILE_BYTES, type BackupDestination, type BackupLogEntry, type BackupPreview } from '@/domain/backup/types';
import { BackupValidationError } from '@/domain/backup/validation';

import type { BackupLogRepository } from './BackupLogRepository';
import type { BackupPayloadService, InspectedBackup } from './BackupPayloadService';
import type { BackupService } from './BackupService';
import type { BackupFileExchange, PickedBackupFile } from './files/BackupFileExchange';
import type { LocalBackupService } from './LocalBackupService';

/** Where the backup to restore comes from. */
export type RestoreSource =
  | { kind: 'picked_file'; file: PickedBackupFile }
  | { kind: 'local'; entry: BackupLogEntry }
  | { kind: 'google_drive'; fileId: string; fileName: string | null };

/** A backup that was read and fully validated, waiting for the user to confirm. Nothing has been changed yet. */
export interface PreparedRestore {
  source: RestoreSource;
  inspected: InspectedBackup;
  preview: BackupPreview;
}

export interface RestoreResult {
  entry: BackupLogEntry;
  /** The safety backup taken first — null only if it failed, in which case nothing was restored. */
  safetyBackup: BackupLogEntry | null;
}

function errorMessageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function destinationOf(source: RestoreSource): BackupDestination {
  return source.kind === 'google_drive' ? 'google_drive' : 'local';
}

function fileNameOf(source: RestoreSource): string | null {
  switch (source.kind) {
    case 'picked_file':
      return source.file.name;
    case 'local':
      return source.entry.fileName;
    default:
      return source.fileName;
  }
}

/**
 * Every restore — an imported file, a local backup from the history, or a
 * Google Drive backup — goes through these two steps:
 *
 *  1. `prepare()` reads the file and runs every check in
 *     `validateBackupPayload()` (size, structure, version, checksum, field
 *     values, relationships). Nothing is modified; the caller shows the
 *     preview and asks the user to confirm.
 *  2. `restore()` first writes a durable safety backup of the current data
 *     (and aborts if that fails), then replaces the data in one transaction
 *     via `BackupPayloadService.apply()`. If that fails, the database and
 *     logo are exactly as they were.
 *
 * The backup history, the safety files, the subscription cache, App Lock
 * and this install's RevenueCat identity are never part of a restore.
 */
export class BackupRestoreService {
  constructor(
    private readonly payloads: BackupPayloadService,
    private readonly local: LocalBackupService,
    private readonly drive: BackupService,
    private readonly exchange: BackupFileExchange,
    private readonly logRepository: BackupLogRepository,
    private readonly now: () => number = Date.now,
  ) {}

  /** Throws `BackupValidationError` for a bad file, or a plain `Error` when it can't be read. */
  async prepare(source: RestoreSource): Promise<PreparedRestore> {
    const raw = await this.read(source);
    const inspected = this.payloads.inspect(raw);
    return { source, inspected, preview: inspected.preview };
  }

  private async read(source: RestoreSource): Promise<string> {
    switch (source.kind) {
      case 'picked_file': {
        if (source.file.sizeBytes !== null && source.file.sizeBytes > MAX_BACKUP_FILE_BYTES) {
          throw new BackupValidationError('too_large', 'This file is too large to be a Metriqo backup.');
        }
        try {
          return await this.exchange.readPickedFile(source.file.uri);
        } finally {
          await this.exchange.discardPickedFile(source.file.uri);
        }
      }
      case 'local':
        return this.local.read(source.entry);
      default:
        return this.drive.downloadBackup(source.fileId);
    }
  }

  async restore(prepared: PreparedRestore): Promise<RestoreResult> {
    const startedAt = this.now();
    const base = {
      direction: 'restore' as const,
      trigger: 'manual' as const,
      destination: destinationOf(prepared.source),
      startedAt: new Date(startedAt).toISOString(),
      fileName: fileNameOf(prepared.source),
    };

    const safety = await this.local.createSafetyBackup();
    if (safety.entry.status !== 'success') {
      const entry = await this.logRepository.add({
        ...base,
        status: 'failure',
        finishedAt: new Date(this.now()).toISOString(),
        formatVersion: prepared.inspected.payload.formatVersion,
        sizeBytes: prepared.preview.sizeBytes,
        counts: null,
        errorMessage: `Couldn't save a safety backup of your current data, so nothing was restored. ${safety.entry.errorMessage ?? ''}`.trim(),
      });
      return { entry, safetyBackup: null };
    }

    try {
      await this.payloads.apply(prepared.inspected, safety.sourceLogoUri);
    } catch (err) {
      const entry = await this.logRepository.add({
        ...base,
        status: 'failure',
        finishedAt: new Date(this.now()).toISOString(),
        formatVersion: prepared.inspected.payload.formatVersion,
        sizeBytes: prepared.preview.sizeBytes,
        counts: null,
        errorMessage: `Restore failed and your existing data was not changed. ${errorMessageOf(err)}`,
      });
      return { entry, safetyBackup: safety.entry };
    }

    const entry = await this.logRepository.add({
      ...base,
      status: 'success',
      finishedAt: new Date(this.now()).toISOString(),
      formatVersion: prepared.inspected.payload.formatVersion,
      sizeBytes: prepared.preview.sizeBytes,
      counts: prepared.preview.counts,
      errorMessage: null,
    });
    return { entry, safetyBackup: safety.entry };
  }
}
