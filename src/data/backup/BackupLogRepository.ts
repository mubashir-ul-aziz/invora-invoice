import type { BackupLogEntry } from '@/domain/backup/types';

/** Everything needed to record one new history row; `id` is filled in by the repository. The file fields are optional because only some attempts produce a file. */
export type BackupLogEntryInput = Omit<BackupLogEntry, 'id' | 'fileName' | 'fileUri' | 'remoteFileId'> &
  Partial<Pick<BackupLogEntry, 'fileName' | 'fileUri' | 'remoteFileId'>>;

/**
 * The backup history's data source. Kept separate from `BackupRepository`
 * (which moves *user data*) because this table is app-generated metadata
 * about this device's backup attempts — a restore never overwrites it, so
 * the history and its safety backups survive every restore. See the doc
 * comment on `backupLog` in `data/db/schema.ts`.
 */
export interface BackupLogRepository {
  /** Newest first. */
  list(): Promise<BackupLogEntry[]>;
  get(id: string): Promise<BackupLogEntry | null>;
  add(entry: BackupLogEntryInput): Promise<BackupLogEntry>;
  /** Removes one history row (after the user deleted its backup file). */
  remove(id: string): Promise<void>;
}
