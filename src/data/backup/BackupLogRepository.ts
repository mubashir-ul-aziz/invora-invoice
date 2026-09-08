import type { BackupLogEntry } from '@/domain/backup/types';

/** Everything needed to record one new history row; `id`/`finishedAt`/etc. are filled in by the repository. */
export type BackupLogEntryInput = Omit<BackupLogEntry, 'id'>;

/**
 * The Backup History screen's data source. Kept separate from
 * `BackupRepository` (which moves *user data*) because this table is
 * app-generated metadata about backup attempts, not something a restore ever
 * overwrites — see the doc comment on `backupLog` in `data/db/schema.ts`.
 */
export interface BackupLogRepository {
  /** Newest first. */
  list(): Promise<BackupLogEntry[]>;
  add(entry: BackupLogEntryInput): Promise<BackupLogEntry>;
}
